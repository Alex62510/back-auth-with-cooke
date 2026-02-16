import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { BoardCell } from '../auth/types';
import { User } from '../auth/user.model';

type UserStatus = 'online' | 'offline' | 'in-game';

interface LobbyUser {
  id: number;
  status: UserStatus;
}

interface Battle {
  boards: Map<number, BoardCell[][]>;
  currentTurn: number;
  players: [number, number];
  chat: { senderId: number; message: string; timestamp: number }[];
}

@WebSocketGateway({
  cors: { origin: process.env.CLIENT_URL, credentials: true },
})
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LobbyGateway.name);
  private gameRooms = new Map<number, string>();
  private battles = new Map<string, Battle>();
  private connections = new Map<number, Set<string>>();

  /* ===================== CONNECTION ===================== */
  handleConnection(client: Socket) {
    const userId = Number(client.handshake.auth?.userId);
    if (!userId) {
      this.logger.warn('CONNECT without userId');
      client.disconnect();
      return;
    }

    this.logger.log(`CONNECT user=${userId} socket=${client.id}`);

    if (!this.connections.has(userId)) this.connections.set(userId, new Set());
    this.connections.get(userId)!.add(client.id);

    this.sendStatusesTo(client);
    this.broadcastStatuses();

    client.on('invite_game', (targetUserId: number) =>
      this.inviteGame(userId, targetUserId),
    );
    client.on('accept_game', ({ from, to }: { from: number; to: number }) =>
      this.acceptGame(from, to),
    );
    client.on(
      'player_ready',
      ({ gameId, board }: { gameId: string; board: BoardCell[][] }) =>
        this.playerReady(userId, gameId, board),
    );
    client.on(
      'shoot',
      ({ gameId, x, y }: { gameId: string; x: number; y: number }) =>
        this.shoot(userId, gameId, x, y),
    );
    client.on(
        'battle_chat',
        ({ gameId, message }: { gameId: string; message: string }) =>
            this.handleBattleChat(userId, gameId, message),
    );
  }

  handleDisconnect(client: Socket) {
    const entry = [...this.connections.entries()].find(([, sockets]) =>
      sockets.has(client.id),
    );
    if (!entry) return;

    const [userId, sockets] = entry;
    sockets.delete(client.id);
    if (sockets.size === 0) this.connections.delete(userId);

    this.logger.log(`DISCONNECT user=${userId} socket=${client.id}`);
    this.broadcastStatuses();
  }

  /* ===================== GAME ===================== */
  inviteGame(fromUserId: number, toUserId: number) {
    const toSockets = this.connections.get(toUserId);
    if (!toSockets) return;

    toSockets.forEach((socketId) => {
      const socket = this.server.sockets.sockets.get(socketId);
      socket?.emit('game_invite', { from: fromUserId });
    });
  }

  acceptGame(fromUserId: number, toUserId: number) {
    const gameId = `room-${Date.now()}`;
    this.gameRooms.set(fromUserId, gameId);
    this.gameRooms.set(toUserId, gameId);
    this.updateUserStatus(fromUserId, 'in-game');
    this.updateUserStatus(toUserId, 'in-game');
    const senderSockets = this.connections.get(fromUserId);
    senderSockets?.forEach((socketId) => {
      const socket = this.server.sockets.sockets.get(socketId);
      socket?.emit('game_accepted', { from: toUserId, gameId });
    });

    // Событие начала игры для обоих
    [fromUserId, toUserId].forEach((uid) => {
      const sockets = this.connections.get(uid);
      sockets?.forEach((socketId) => {
        const socket = this.server.sockets.sockets.get(socketId);
        socket?.emit('game_start', { gameId });
      });
    });

    // Инициализация battle
    this.battles.set(gameId, {
      boards: new Map(),
      currentTurn: 0,
      players: [fromUserId, toUserId],
      chat: [],
    });
  }

  playerReady(userId: number, gameId: string, board: BoardCell[][]) {
    const battle = this.battles.get(gameId);
    if (!battle) return;

    battle.boards.set(userId, board);

    if (battle.boards.size === 2) {
      const [player1, player2] = battle.players;
      battle.currentTurn = player1;

      [player1, player2].forEach((uid) => {
        const enemyId = uid === player1 ? player2 : player1;
        const enemyBoard = battle.boards.get(enemyId)!;
        const sockets = this.connections.get(uid);
        sockets?.forEach((sid) => {
          const sock = this.server.sockets.sockets.get(sid);
          sock?.emit('battle_start', {
            enemyBoard,
            myTurn: battle.currentTurn === uid,
            gameId,
            opponentId: enemyId,
          });
        });
      });
    }
  }

  async shoot(userId: number, gameId: string, x: number, y: number) {
    const battle = this.battles.get(gameId);
    if (!battle || battle.currentTurn !== userId) return;

    const opponentId = battle.players.find((id) => id !== userId)!;
    const opponentBoard = battle.boards.get(opponentId)!;
    const cell = opponentBoard[y][x];
    const hit = cell.hasShip;
    cell.isHit = true;

    // Проверяем живые корабли противника
    const opponentAlive = opponentBoard.some((row) =>
      row.some((c) => c.hasShip && !c.isHit),
    );

    if (!opponentAlive) {
      // ⚡ Игра закончилась — уведомляем игроков
      [userId, opponentId].forEach((uid) => {
        const sockets = this.connections.get(uid);
        sockets?.forEach((sid) => {
          const sock = this.server.sockets.sockets.get(sid);
          sock?.emit('game_finished', {
            winnerId: userId,
          });
        });
      });

      // ⚡ Обновляем статистику побед/поражений
      this.updateUserStatus(userId, 'online');
      this.updateUserStatus(opponentId, 'online');
      await this.incrementUserStats(userId, true); // победитель
      await this.incrementUserStats(opponentId, false); // проигравший
      return;
    }

    // Смена очередности только если промах
    if (!hit) {
      battle.currentTurn = opponentId;
    }

    [userId, opponentId].forEach((uid) => {
      const sockets = this.connections.get(uid);
      sockets?.forEach((sid) => {
        const sock = this.server.sockets.sockets.get(sid);
        sock?.emit('shot_result', {
          x,
          y,
          hit,
          shooter: userId,
          nextTurn: battle.currentTurn,
        });
      });
    });
  }

  /** 🔥 Новый метод для статистики */
  private async incrementUserStats(userId: number, win: boolean) {
    const user = await User.findByPk(userId);
    if (!user) return;

    if (win) user.wins += 1;
    else user.loses += 1;

    await user.save();
  }

  private updateUserStatus(userId: number, status: UserStatus) {
    // Бродкастим всем
    const payload: LobbyUser = { id: userId, status };
    this.server.emit('user_status_update', payload);
  }
  private handleBattleChat(userId: number, gameId: string, message: string) {
    const battle = this.battles.get(gameId);
    if (!battle) return;

    const chatMessage = {
      senderId: userId,
      message,
      timestamp: Date.now(),
    };

    // Добавляем в историю
    battle.chat.push(chatMessage);

    // Отправляем всем игрокам в битве
    battle.players.forEach((uid) => {
      const sockets = this.connections.get(uid);
      sockets?.forEach((sid) => {
        const sock = this.server.sockets.sockets.get(sid);
        sock?.emit('battle_chat', chatMessage);
      });
    });
  }
  @SubscribeMessage('logout')
  handleLogout(@MessageBody() userId: number) {
    const sockets = this.connections.get(userId);
    if (!sockets) return;

    for (const socketId of sockets) {
      const socket = this.server.sockets.sockets.get(socketId);
      socket?.disconnect(true);
    }

    this.connections.delete(userId);
    this.broadcastStatuses();
  }

  /* ===================== STATUS ===================== */
  private sendStatusesTo(client: Socket) {
    const payload: LobbyUser[] = [];
    for (const [userId] of this.connections.entries()) {
      payload.push({ id: userId, status: 'online' });
    }
    client.emit('users_status', payload);
  }

  private broadcastStatuses() {
    const payload: LobbyUser[] = [];
    for (const [userId] of this.connections.entries()) {
      payload.push({ id: userId, status: 'online' });
    }
    this.server.emit('users_status', payload);
  }
}

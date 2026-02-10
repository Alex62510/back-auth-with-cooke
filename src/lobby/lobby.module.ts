import { Module } from '@nestjs/common';
import { LobbyGateway } from './lobby.gateway';

@Module({
  providers: [LobbyGateway],
  exports: [LobbyGateway],
})
export class LobbyModule {}

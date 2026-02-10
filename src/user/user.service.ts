import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../auth/user.model';

export interface FrontUser {
  id: number;
  username: string;
  email: string;
  friends: number[];
}

@Injectable()
export class UserService {
  constructor(@InjectModel(User) private userModel: typeof User) {}

  async getAllUsers(): Promise<FrontUser[]> {
    const users = await this.userModel.findAll();
    return users.map((u) => ({
      id: u.id,
      username: u.name,
      email: u.email,
      friends: [],
      wins: u.wins,
      loses: u.loses,
    }));
  }

  async getUserById(id: number): Promise<FrontUser | null> {
    const u = await this.userModel.findByPk(id);
    if (!u) return null;
    return {
      id: u.id,
      username: u.name,
      email: u.email,
      friends: [],
    };
  }
}

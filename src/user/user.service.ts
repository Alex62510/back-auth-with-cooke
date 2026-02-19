import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../auth/user.model';

export interface FrontUser {
  id: number;
  name: string;
  email: string;
  friends: number[];
  wins: number;
  loses: number;
}

@Injectable()
export class UserService {
  constructor(@InjectModel(User) private userModel: typeof User) {}

  async getAllUsers(): Promise<FrontUser[]> {
    const users = await this.userModel.findAll();
    return users.map((u) => ({
      id: u.id,
      name: u.name,
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
      name: u.name,
      email: u.email,
      friends: [],
      wins: u.wins,
      loses:u.loses
    };
  }

  async updateUser(
      id: number,
      data: Partial<{ name: string }>
  ): Promise<FrontUser | null> {
    const user = await this.userModel.findByPk(id);
    if (!user) return null;

    if (data.name !== undefined) {
      user.name = data.name;
    }

    await user.save();
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      friends: [],
      wins: user.wins,
      loses: user.loses,
    }
  }
}

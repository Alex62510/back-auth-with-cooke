import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './user.model';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from './constants';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private userModel: typeof User,
    private jwtService: JwtService,
  ) {}

  async register(dto: CreateUserDto) {
    const hash = await bcrypt.hash(dto.password, 10);

    const user: User = await this.userModel.create({
      ...dto,
      password: hash,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('User not found');

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new BadRequestException('Invalid password');

    // payload как Record<string, unknown> с generic
    const payload: Record<string, unknown> = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync<
      Record<string, unknown>
    >(payload, {
      secret: jwtConstants.accessSecret,
      expiresIn: jwtConstants.accessExpiration,
    });

    const refreshToken = await this.jwtService.signAsync<
      Record<string, unknown>
    >(payload, {
      secret: jwtConstants.refreshSecret,
      expiresIn: jwtConstants.refreshExpiration,
    });

    await user.update({ refreshToken });

    return { accessToken, refreshToken, user };
  }

  async refreshTokens(userId: number, refreshToken: string) {
    const user = await this.userModel.findByPk(userId);
    if (!user || user.refreshToken !== refreshToken)
      throw new UnauthorizedException('Invalid refresh token');

    const payload: Record<string, unknown> = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync<
      Record<string, unknown>
    >(payload, {
      secret: jwtConstants.accessSecret,
      expiresIn: jwtConstants.accessExpiration,
    });

    const newRefreshToken = await this.jwtService.signAsync<
      Record<string, unknown>
    >(payload, {
      secret: jwtConstants.refreshSecret,
      expiresIn: jwtConstants.refreshExpiration,
    });

    await user.update({ refreshToken: newRefreshToken });

    return { accessToken, refreshToken: newRefreshToken, user };
  }

  verifyRefreshToken(token: string): { sub: number; email: string } {
    try {
      return this.jwtService.verify<{ sub: number; email: string }>(token, {
        secret: jwtConstants.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: number) {
    await this.userModel.update(
      { refreshToken: null },
      { where: { id: userId } },
    );
  }
}

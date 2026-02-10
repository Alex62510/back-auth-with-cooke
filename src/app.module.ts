import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule, SequelizeModuleOptions } from '@nestjs/sequelize';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/user.model';
import { UserModule } from './user/user.module';
import { GameModule } from './game/GameModule.module';
import { LobbyModule } from './lobby/lobby.module';

@Module({
  imports: [
    // Загружаем .env глобально

    ConfigModule.forRoot({ isGlobal: true }),

    // Настройка Sequelize через фабрику
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): SequelizeModuleOptions => ({
        dialect: 'postgres',

        host: configService.get<string>('DATABASE_HOST') || 'localhost',

        port: Number(configService.get<string>('DATABASE_PORT') || 5432),

        username: configService.get<string>('DATABASE_USER') || 'postgres',

        password: configService.get<string>('DATABASE_PASSWORD') || '',

        database: configService.get<string>('DATABASE_NAME') || 'postgres',
        models: [User],
        autoLoadModels: true,
        synchronize: true,
        logging: console.log,
      }),
    }),
    LobbyModule,
    GameModule,
    AuthModule,
    UserModule,
  ],
})
export class AppModule {}

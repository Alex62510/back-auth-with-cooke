import {Body, Controller, Get, Param, Patch} from '@nestjs/common';
import { UserService, FrontUser } from './user.service';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  getAllUsers(): Promise<FrontUser[]> {
    return this.userService.getAllUsers();
  }

  @Get(':id')
  getUser(@Param('id') id: string): Promise<FrontUser | null> {
    return this.userService.getUserById(+id);
  }
  @Patch(':id')
  updateUser(
      @Param('id') id: string,
      @Body() data: Partial<{ name: string }>
  ): Promise<FrontUser | null> {
    return this.userService.updateUser(+id, data);
  }
}

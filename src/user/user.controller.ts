import { Controller, Get, Param } from '@nestjs/common';
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
}

export interface JwtPayload {
  sub: number;
  email: string;
}
export interface RequestWithUser extends Request {
  user: JwtPayload;
}
export interface BoardCell {
  x: number;
  y: number;
  ship?: Ship;
  hasShip: boolean;
  isHit: boolean;
  blocked: boolean;
}

export interface Ship {
  id: string;
  size: number;
  orientation: 'horizontal' | 'vertical';
  placed?: boolean;
}

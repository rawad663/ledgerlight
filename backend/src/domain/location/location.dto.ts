import { IsDate, IsString, IsUUID } from 'class-validator';

export class LocationDto {
  @IsUUID('loose')
  @IsString()
  id: string;

  @IsUUID('loose')
  @IsString()
  organizationId: string;

  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}

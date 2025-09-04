import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('users') // explicit table name is better for production
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ default: 'user' })
  role!: string;

  //  Email confirmation
  @Column({ default: false })
  isEmailConfirmed!: boolean;

  @Column({ type: 'varchar', nullable: true })  
  resetToken!: string | null;

  @Column({ type: 'datetime', nullable: true })  
  resetTokenExpiry!: Date | null;

}

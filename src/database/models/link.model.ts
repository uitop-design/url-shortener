import { Generated, Model } from 'objection';

export class LinkModel extends Model {
  static override tableName = 'links';

  id!: Generated<string>;
  code!: string;
  url!: string;
  expiresAt!: Date | null;
  clicks!: Generated<number>;
  lastAccessedAt!: Date | null;
  createdAt!: Generated<Date>;
  updatedAt!: Generated<Date>;

  override $beforeUpdate(): void {
    this.updatedAt = new Date();
  }
}

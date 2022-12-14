import { getModelForClass, modelOptions, plugin, prop, Severity } from '@typegoose/typegoose';
import { DiscordData } from '../middleware/authentication';
import { AutoIncrementSimple } from '@typegoose/auto-increment';

@plugin(AutoIncrementSimple, [{ field: 'join' }])
@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class User {
	@prop({ _id: true })
	public _id: string;

	@prop({ required: true })
	public tag: string;

	@prop({ required: true })
	public avatar: string;

	@prop({ required: true })
	public createdAt: number;

	@prop({ required: true })
	public join: number;

	@prop({ default: undefined })
	public admin?: boolean;

	@prop({ default: undefined })
	public flags?: string[];

	@prop({ default: undefined })
	public invite: string;

	@prop({ default: undefined })
	public suspended?: string;

	// Methods
	public getAvatarURL(): string {
		return `https://cdn.discordapp.com/avatars/${this._id}/${this.avatar}.png`;
	}

	public toJson(): any {
		return JSON.parse(JSON.stringify(this));
	}

	public static async create(discord: DiscordData): Promise<User> {
		const user = new UserModel({
			_id: discord.id,
			tag: discord.username + '#' + discord.discriminator,
			avatar: discord.avatar,
			flags: ['beta_tester'],
			createdAt: Date.now()
		});
		await user.save();
		return user;
	}
}

// Export Models
export const UserModel = getModelForClass(User);

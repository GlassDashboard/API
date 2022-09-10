import { getModelForClass, modelOptions, prop, Severity } from '@typegoose/typegoose';

export type HostLocation = 'MINEHUT';

@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class Server {
	@prop({ _id: true })
	public _id: string;

	@prop({ required: true })
	public token: string;

	@prop({ required: true })
	public name: string;

	@prop({ required: true })
	public owner: string;

	@prop({ default: undefined })
	public apiOwner: string;

	@prop({ default: undefined })
	public apiID: string;

	@prop({ default: undefined })
	public suspended?: string;

	@prop({ required: true, default: 'MINEHUT' })
	public host: HostLocation;

	@prop({ required: true, default: [] })
	public users: Subuser[];

	@prop({ default: undefined })
	public network?: string[];

	@prop({ default: undefined })
	public setup?: boolean;

	// Methods
	public hasPermission(user: string, permission: ServerPermission): boolean {
		const permissions = this.getPermissions(user);
		if (permissions == -1 || (permission & permissions) != 0) return true;
		return false;
	}

	public getPermissions(user: string): number {
		return this.users.find((u) => u._id === user)?.permissions ?? -1;
	}

	public toJson(): any {
		return JSON.parse(JSON.stringify(this));
	}
}

class Subuser {
	@prop({ required: true })
	public _id: string;

	@prop({ required: true })
	public permissions: number;
}

export enum ServerPermission {
	// Default Permissions
	VIEW_CONSOLE = 1 << 0,
	USE_CONSOLE = 1 << 1,
	CONTROL_SERVER = 1 << 2,
	READ_FILES = 1 << 3,
	WRITE_FILES = 1 << 4,
	MANAGE_PLAYERS = 1 << 5,
	VIEW_PERFORMANCE = 1 << 6,
	VIEW_PLUGINS = 1 << 7,
	MANAGE_PLUGINS = 1 << 8,

	// Server Permissions
	MANAGE_SUBUSERS = 1 << 9,
	MANAGE_INTEGRATIONS = 1 << 10,
	MANAGE_SERVER = 1 << 11
}

// Export Models
export const ServerModel = getModelForClass(Server);
import { getModelForClass, modelOptions, prop, Severity } from '@typegoose/typegoose';

export type HostLocation = 'MINEHUT';
export type ServerType = 'SPIGOT' | 'PAPER' | 'FORGE' | 'FABRIC' | 'BUNGEECORD' | 'VELOCITY';

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

	@prop({ required: true, default: [] })
	public ftp: FTPDetails[];

	@prop({ required: true })
	public serverType: ServerType;

	@prop({ required: true })
	public createdAt: number;

	@prop({ default: undefined })
	public lastOnline: number;

	// Methods
	public hasPermission(user: string, permission: ServerPermission): boolean {
		const permissions = this.getPermissions(user);
		if (permissions == null) return false;
		return permissions == -1 || (permission & permissions) != 0;
	}

	public getPermissions(user: string): number | null {
		if (this.owner == user) return -1;
		return this.users.find((u) => u._id === user)?.permissions ?? null;
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

class FTPDetails {
	@prop({ required: true })
	public identifier: string;

	@prop({ required: true })
	public password: string;

	@prop({ required: true })
	public assignee: string;
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
	FTP_ACCESS = 1 << 9,

	// Server Permissions
	MANAGE_SUBUSERS = 1 << 10,
	MANAGE_INTEGRATIONS = 1 << 11,
	MANAGE_SERVER = 1 << 12
}

// Export Models
export const ServerModel = getModelForClass(Server);

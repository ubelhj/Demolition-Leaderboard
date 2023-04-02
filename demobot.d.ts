declare module DemobotTypes {
    class Player {
        DISCORD_ID: string;
        NAME: string;
        DEMOLITIONS: int;
        EXTERMINATIONS: int;
        COUNTRY: string|null;
        LAST_UPDATE: string;
        AUTHORIZED: AuthorizationLevel;
        DELETED_AT: string|null;
    }

    class HistoryEntry {
        DISCORD_ID: string;
        DEMOLITIONS: int;
        EXTERMINATIONS: int;
        TIMESTAMP: string;
        DELETED_AT: string|null;
    }

    /**
     * Levels of allowed scores
     * LEVEL_NONE allows less than 10k demos and 100 exterms
     * LEVEL_OVER_10K allows any score less than the highest score
     * LEVEL_TOP allows any score
     */
    enum AuthorizationLevel {
        LEVEL_NONE = 0,
        LEVEL_OVER_10K = 1,
        LEVEL_TOP = 2,
    }
}
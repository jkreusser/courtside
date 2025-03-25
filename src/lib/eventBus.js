class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Fehler im Event-Handler für ${event}:`, error);
                }
            });
        }
    }
}

export const eventBus = new EventBus();

export const EVENTS = {
    DATA_REFRESH: 'data_refresh',
    VISIBILITY_CHANGE: 'visibility_change',
    CONNECTION_CHANGE: 'connection_change'
}; 
import winston from 'winston';

const loggerOptions = process.env.NODE_ENV === 'production' ? {
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'metafields-sync-service' },
    transports: [
        new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: './logs/combined.log' }),
    ],
} : {
    level: 'debug',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `[${timestamp}] ${level}: ${message} ${metaString}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
        new winston.transports.Console()
    ]
};

export const Logger = winston.createLogger(loggerOptions);
export const LogError = (message: string, context: any) => {
    Logger.error
}
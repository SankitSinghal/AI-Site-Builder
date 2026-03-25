"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const node_1 = require("better-auth/node");
const auth_js_1 = require("./lib/auth.js");
const prisma_js_1 = __importDefault(require("./lib/prisma.js"));
const morgan_1 = __importDefault(require("morgan"));
const userRoutes_js_1 = __importDefault(require("./routes/userRoutes.js"));
const projectRoutes_js_1 = __importDefault(require("./routes/projectRoutes.js"));
const stripeWebhook_js_1 = require("./controllers/stripeWebhook.js");
const app = (0, express_1.default)();
const port = 3000;
const corsOptions = {
    origin: process.env.TRUSTED_ORIGINS?.split(',') || [],
    credentials: true,
};
app.use((0, cors_1.default)(corsOptions));
app.post('/api/stripe', express_1.default.raw({ type: 'application/json' }), stripeWebhook_js_1.stripeWebhook);
app.all('/api/auth/{*any}', (0, node_1.toNodeHandler)(auth_js_1.auth));
app.use(express_1.default.json({ limit: '50mb' }));
if (process.env.NODE_ENV === "development") {
    app.use((0, morgan_1.default)('dev'));
}
app.get('/', (req, res) => {
    res.send('Server is Live!');
});
app.use('/api/user', userRoutes_js_1.default);
app.use('/api/project', projectRoutes_js_1.default);
app.get("/check", async (req, res) => {
    try {
        await prisma_js_1.default.$connect();
        res.status(200).json({ message: "Database connected" });
    }
    catch (error) {
        res.status(500).json({ message: "Database not coneected" });
    }
});
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

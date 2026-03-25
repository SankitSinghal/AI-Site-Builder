"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protect = void 0;
const auth_1 = require("../lib/auth");
const node_1 = require("better-auth/node");
const protect = async (req, res, next) => {
    try {
        const session = await auth_1.auth.api.getSession({
            headers: (0, node_1.fromNodeHeaders)(req.headers)
        });
        if (!session || !session.user) {
            return res.status(401).json({ message: 'Unauthorized user' });
        }
        req.userId = session.user.id;
        next();
    }
    catch (error) {
        console.log(error);
        res.status(401).json({ message: error.code || error.message });
    }
};
exports.protect = protect;

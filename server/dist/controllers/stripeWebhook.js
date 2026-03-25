"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = void 0;
const stripe_1 = __importDefault(require("stripe"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY);
const stripeWebhook = async (req, res) => {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers["stripe-signature"];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    }
    catch (err) {
        console.log(" Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    try {
        switch (event.type) {
            // CORRECT EVENT FOR CHECKOUT
            case "checkout.session.completed": {
                const session = event.data.object;
                const metadata = session.metadata;
                if (!metadata || metadata.appId !== "AI-Site-Builder") {
                    console.log("Invalid metadata");
                    break;
                }
                const { transactionId } = metadata;
                if (!transactionId) {
                    console.log("Missing transactionId");
                    break;
                }
                const transaction = await prisma_1.default.transaction.update({
                    where: { id: transactionId },
                    data: { isPaid: true },
                });
                // Add credits to user
                await prisma_1.default.user.update({
                    where: { id: transaction.userId },
                    data: {
                        credits: {
                            increment: transaction.credits,
                        },
                    },
                });
                console.log("Payment successful & credits added");
                break;
            }
            default:
                console.log(`⚠️ Unhandled event type: ${event.type}`);
        }
        res.json({ received: true });
    }
    catch (error) {
        console.log("Webhook processing error:", error.message);
        res.status(500).json({ error: "Webhook handler failed" });
    }
};
exports.stripeWebhook = stripeWebhook;

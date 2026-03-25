"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveProjectCode = exports.getProjectById = exports.getPublishedProject = exports.getProjectPreview = exports.deleteProject = exports.rollbackToVersion = exports.makeRevision = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const gemini_1 = require("../configs/gemini");
// Controller function to make revision
const makeRevision = async (req, res) => {
    const userId = req.userId;
    try {
        const { projectId } = req.params;
        const { message } = req.body;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized user" });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: String(userId) },
        });
        if (!user) {
            return res.status(401).json({ message: "Unauthorized user" });
        }
        if (user.credits < 5) {
            return res.status(403).json({ message: "Add more credits to make changes" });
        }
        if (!message || message.trim() === "") {
            return res.status(400).json({ message: "Please enter a valid prompt" });
        }
        const currentProject = await prisma_1.default.websiteProject.findFirst({
            where: {
                id: String(projectId),
                userId: String(userId),
            },
            include: { versions: true },
        });
        if (!currentProject) {
            return res.status(404).json({ message: "Project not found" });
        }
        await prisma_1.default.conversation.create({
            data: {
                role: "user",
                content: message,
                projectId: String(projectId),
            },
        });
        await prisma_1.default.user.update({
            where: { id: String(userId) },
            data: { credits: { decrement: 5 } },
        });
        //Controller function to enhance user prompt
        const enhanceSystemInstruction = `
      You are a prompt enhancement specialist. Take the user's website request and expand it into a detailed,
      comprehensive prompt that will help create the best possible websites.

      Enhance this prompt by:
      1. Adding specific design details (layout, color scheme, typography)
      2. Specifying key sections and features
      3. Describing the user experience and interactions
      4. Including modern web design best practices
      5. Mentioning responsive design requirements
      6. Adding any missing but important elements

      Return ONLY the enhanced prompt. Make it detailed but concise (2-3 paragraphs max).`;
        const enhanceUserMessage = `User's request: "${message}"`;
        const enhancedPrompt = await (0, gemini_1.generateGeminiResponse)(enhanceUserMessage, enhanceSystemInstruction);
        await prisma_1.default.conversation.create({
            data: {
                role: "assistant",
                content: `I've enhanced your prompt to: "${enhancedPrompt}"`,
                projectId: String(projectId),
            },
        });
        await prisma_1.default.conversation.create({
            data: {
                role: "assistant",
                content: `Now making changes to your website...`,
                projectId: String(projectId),
            },
        });
        // Generate website code with enhanced prompt
        const codeGenSystemInstruction = `
      You are an expert web developer.

      CRITICAL REQUIREMENTS:   
      - Return ONLY the completed updated HTML code with the requested changes.
      - Use Tailwind CSS for all styling.
      - Use Tailwind utility classes for styling.
      - Include all JavaScript in <script> tags before closing </body>.
      - Make sure it's a complete standalone HTML document with Tailwind.
      - Return HTML code only, nothing else.

      Apply the requested changes while maintaining Tailwind CSS styling.`;
        const codeGenUserMessage = `Here is the current website code: "${currentProject.current_code}"\nThe user wants this change:"${enhancedPrompt}"`;
        const code = await (0, gemini_1.generateGeminiResponse)(codeGenUserMessage, codeGenSystemInstruction);
        if (!code) {
            await prisma_1.default.conversation.create({
                data: {
                    role: "assistant",
                    content: "Unable to generate the code, please try again",
                    projectId: String(projectId),
                },
            });
            await prisma_1.default.user.update({
                where: { id: String(userId) },
                data: { credits: { increment: 5 } },
            });
            return;
        }
        const cleanedCode = code
            .replace(/```[a-z]*\n?/gi, "")
            .replace(/```$/g, "")
            .trim();
        const version = await prisma_1.default.version.create({
            data: {
                code: cleanedCode,
                description: "Changes made",
                projectId: String(projectId),
            },
        });
        await prisma_1.default.conversation.create({
            data: {
                role: "assistant",
                content: "I've made the changes to your website. You can preview it.",
                projectId: String(projectId),
            },
        });
        await prisma_1.default.websiteProject.update({
            where: { id: String(projectId) },
            data: {
                current_code: cleanedCode,
                current_version_index: version.id,
            },
        });
        res.json({ message: "Changes made successfully" });
    }
    catch (error) {
        if (userId) {
            await prisma_1.default.user.update({
                where: { id: String(userId) },
                data: { credits: { increment: 5 } },
            });
        }
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};
exports.makeRevision = makeRevision;
// Controller function to rollback to a specific version
const rollbackToVersion = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized user" });
        }
        const { projectId, versionId } = req.params;
        const project = await prisma_1.default.websiteProject.findFirst({
            where: { id: String(projectId), userId: String(userId) },
            include: { versions: true },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        const version = project.versions.find((version) => version.id === versionId);
        if (!version) {
            return res.status(404).json({ message: "Version not found" });
        }
        await prisma_1.default.websiteProject.update({
            where: { id: String(projectId), userId: String(userId) },
            data: {
                current_code: version.code,
                current_version_index: version.id
            },
        });
        await prisma_1.default.conversation.create({
            data: {
                role: "assistant",
                content: "I've rolled backed to your website to the selected version. You can now preview it.",
                projectId: String(projectId),
            },
        });
        res.json({ message: " Version rolled back successfully" });
    }
    catch (error) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};
exports.rollbackToVersion = rollbackToVersion;
// Controller function to delete a project
const deleteProject = async (req, res) => {
    try {
        const userId = req.userId;
        const { projectId } = req.params;
        const project = await prisma_1.default.websiteProject.findFirst({
            where: { id: String(projectId), userId: String(userId) },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        await prisma_1.default.websiteProject.delete({
            where: { id: project.id },
        });
        res.json({ message: "Project deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.deleteProject = deleteProject;
//Controller for getting project code for preview
const getProjectPreview = async (req, res) => {
    try {
        const userId = req.userId;
        const { projectId } = req.params;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized user" });
        }
        const project = await prisma_1.default.websiteProject.findFirst({
            where: { id: String(projectId), userId: String(userId) },
            include: { versions: true },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        res.json({ project });
    }
    catch (error) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};
exports.getProjectPreview = getProjectPreview;
// Get Published Project
const getPublishedProject = async (req, res) => {
    try {
        const projects = await prisma_1.default.websiteProject.findMany({
            where: {
                isPublished: true
            },
            include: {
                user: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json({ projects });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Failed to fetch projects" });
    }
};
exports.getPublishedProject = getPublishedProject;
//Get a single project by id
const getProjectById = async (req, res) => {
    try {
        const { projectId } = req.params;
        const project = await prisma_1.default.websiteProject.findFirst({
            where: { id: String(projectId) },
        });
        if (!project || project.isPublished === false || !project?.current_code) {
            return res.status(404).json({ message: "Project not found" });
        }
        res.json({ code: project.current_code });
    }
    catch (error) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};
exports.getProjectById = getProjectById;
//Controller to save the project code
const saveProjectCode = async (req, res) => {
    try {
        const userId = req.userId;
        const { projectId } = req.params;
        const { code } = req.body;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized user" });
        }
        if (!projectId || !code) {
            return res.status(400).json({ message: " Code is required" });
        }
        const project = await prisma_1.default.websiteProject.findFirst({
            where: { id: String(projectId), userId: String(userId) },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        await prisma_1.default.websiteProject.update({
            where: { id: String(projectId), userId: String(userId) },
            data: { current_code: code, current_version_index: '' },
        });
        res.json({ message: "Project saved successfully" });
    }
    catch (error) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};
exports.saveProjectCode = saveProjectCode;

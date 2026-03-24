import { Request, Response, } from "express";
import prisma from "../lib/prisma";
import { generateGeminiResponse } from "../configs/gemini";
import Stripe from 'stripe';

interface AuthRequest extends Request {
  userId?: string;
}

// Get User Credits
export const getUserCredits = async (req: AuthRequest, res: Response) => {
  try {
    const  userId  = req.userId;
    console.log(userId);

    if (!userId) {
      return res.status(401).json({ message: "Invalid user" });
    }

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: { credits: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ credits: user.credits });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Create New Project
export const createUserProject = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  try {
    const { initial_prompt } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    if (!initial_prompt || typeof initial_prompt !== "string") {
      return res.status(400).json({ message: "Initial prompt is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if ((user.credits ?? 0) < 5) {
      return res
        .status(403)
        .json({ message: "Add credits to create more projects" });
    }

    const project = await prisma.websiteProject.create({
      data: {
        name:
          initial_prompt.length > 50
            ? initial_prompt.substring(0, 47) + "..."
            : initial_prompt,
        initial_prompt,
        userId: String(userId),
      },
    });

    await prisma.user.update({
      where: { id: String(userId) },
      data: {
        totalCreation: { increment: 1 },
        credits: { decrement: 5 },
      },
    });

    // Enhance prompt
    const enhanceSystemInstruction = `
      You are a prompt enhancement specialist. Take the user's website request and expand it into a detailed,
      comprehensive prompt that will help create the best possible wesites.
      
      Enhance this propmpt by:
      1. Adding specific design details (layout, color scheme, typography)
      2. Specifying key sections and features
      3. Describing the user expereience and interactions
      4. Including the modern web design best practices
      5. Mentioning the responsive design requirements
      6. Adding any missing but important elements
      
      Return ONLY the enhanced prompt, nothing else. Make it detailed but concise(2-3 paragraphs max).`;

    const enhancedPrompt = await generateGeminiResponse(initial_prompt, enhanceSystemInstruction);

    await prisma.conversation.create({
      data: {
        role: "assistant",
        content: `Enhanced prompt: "${enhancedPrompt}"`,
        projectId: project.id,
      },
    });

    await prisma.conversation.create({
      data: {
        role: "assistant",
        content: "Generating your website...",
        projectId: project.id,
      },
    });

    // Generate website code
    const codeGenSystemInstruction = "Generate a complete HTML single page website using Tailwind CSS only. Return HTML code only.";
    
    const code = await generateGeminiResponse(enhancedPrompt, codeGenSystemInstruction);

    if(!code){
      await prisma.conversation.create({
      data: {
        role: "assistant",
        content: "Unable to generate the code, please try again",
        projectId: project.id,
      },
    });
    await prisma.user.update({
        where: { id: String(userId) },
        data: { credits: { increment: 5 } },
      });
      return;
    }

    const cleanedCode = code
      .replace(/```[a-z]*\n?/gi, "")
      .replace(/```$/g, "")
      .trim();

    const version = await prisma.version.create({
      data: {
        code: cleanedCode,
        description: "Initial Version",
        projectId: project.id,
      },
    });

    await prisma.websiteProject.update({
      where: { id: project.id },
      data: {
        current_code: cleanedCode,
        current_version_index: version.id,
      },
    });

    await prisma.conversation.create({
      data: {
        role: "assistant",
        content:`You are an expert web developer. Create a complete, production-ready, single-page website based on this request:
            "${enhancedPrompt}"
            
          CRITICAL REQUIREMENTS:
          - You MUST output valid HTML ONLY.
          - Use Tailwind CSS for ALL styling
          - Include this EXACT script in the <head>: <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
          - Use Tailwind utility classes extensively for styling, animations, and responsiveness.
          - Make it fully functional and interactive with Javascript in <script> tag before closing </body>.
          - Use modern beautiful design with great UX using Tailwind responsive classes(sm:, md:, lg: etc.)
          - Use Tailwind animations and transitions (animate-*, transition-*)
          - Include all necessary meta tags
          - Use Google Fonts CDN if needed for custom fonts 
          - Use placeholder images from https://placehold.co/600*400
          - Use Tailwind gradient classes for beautiful backgrounds 
          - Make sure all buttons, cards, and components use Tailwind styling

          CRITICAL HARD RULES:
          1. You MUST put ALL output ONLY into message.content.
          2. You MUST NOT place anything in "reasoning", "analysis", "reasoning_details", or any hidden fields.
          3. You MUST NOT include internal thoughts, explainations, analysis, comments, or markdown.
          4. Do NOT include markdown, explainations, notes or code fences.

          The HTML should be complete and ready to render as-is with Tailwind CSS.`,
        projectId: project.id,
      },
    });

    return res.status(201).json({ projectId: project.id });
  } catch (error: any) {
    console.error(error);

    if (userId) {
      await prisma.user.update({
        where: { id: String(userId) },
        data: { credits: { increment: 5 } },
      });
    }

    return res
      .status(500)
      .json({ message: error.message || "Something went wrong" });
  }
};

// Controller function to get a single user project
export const getUserProject = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.websiteProject.findUnique({
      where: { id: String(projectId) },
      include: {
        versions: true,
        conversation: { orderBy: { timestamp: "asc" } },
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json({ project });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

//Controller function to get all user projects
export const getUserProjects = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized request" });
    }

    const projects = await prisma.websiteProject.findMany({
      where: { userId: String(userId) },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ projects });
  } catch (error: any) {
    console.error(error?.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// Controlller function to publish a project
export const togglePublish = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.websiteProject.findUnique({
      where: {id: String(projectId) }
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const updatedProject = await prisma.websiteProject.update({
      where: { id: String(projectId) },
      data: {
        isPublished: !project.isPublished
      }
    });

    res.json({
      message: updatedProject.isPublished ? "Project Published" : "Project Unpublished",
      project: updatedProject
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};
 
// Controller function to purchase credits
export const purchaseCredits = async (req: AuthRequest, res: Response) => {
  try {
    interface Plan {
      credits: number;
      amount: number;
    }

    const plans = {
      basic: {credits: 100, amount: 5},
      pro: {credits: 400, amount: 19},
      enterprise: {credits: 1000, amount: 49},

    }
    const userId = req.userId;
    const { planId } = req.body as {planId: keyof typeof plans}
    const origin = req.headers.origin as string;
    
    const plan: Plan = plans[planId]
    if(!plan) {
      return res.status(404).json({message: 'Plan not found '});
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: userId!,
        planId: req.body.planId,
        amount: plan.amount,
        credits: plan.credits
      }
    })

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    
    const session = await stripe.checkout.sessions.create({
        success_url: `${origin}/loading`,
        cancel_url: `${origin}`,
        line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `AISiteBuilder - ${plan.credits} credits`
            },
            unit_amount: Math.floor(transaction.amount) * 100
          },
          quantity: 1
        },
      ],
      mode: 'payment',
      metadata: {
        transactionId: transaction.id,
        appId: 'AI-Site-Builder'
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, //Expires in 30 minutes
    });

    res.json({payment_link: session.url})
      } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({message: error.message});
      }
};



import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withValidation } from "@/lib/validation/middleware";
import { MatchingService } from "@/lib/services/matchingService";

const IgnoreTargetSchema = z.object({
  targetTwitterId: z.string().min(1),
  action: z.enum(['ignore', 'unignore']).default('ignore'),
});

// Handler pour ignorer ou restaurer un compte
async function ignoreHandler(request: NextRequest, data: z.infer<typeof IgnoreTargetSchema>, session: any) {
  try {
    const userId = session.user.id;
    const { targetTwitterId, action } = data;
    const matchingService = new MatchingService();

    // if (action === 'ignore') {
      await matchingService.ignoreTarget(userId, targetTwitterId, action);
      
      console.log("Target ignored successfully", {
        userId,
        targetTwitterId,
        context: "api/migrate/ignore",
      });
    // } else {
    //   await matchingService.unignoreTarget(userId, targetTwitterId);
      
    //   console.log("Target unignored successfully", {
    //     userId,
    //     targetTwitterId,
    //     context: "api/migrate/ignore",
    //   });
    // }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    const action = data.action === 'ignore' ? 'ignore' : 'unignore';
    console.error(`Failed to ${action} target`, {
      error: error instanceof Error ? error.message : String(error),
      context: "api/migrate/ignore",
    });
    
    return NextResponse.json(
      { error: `Failed to ${action} target` },
      { status: 500 }
    );
  }
}

// Options de validation
const validationOptions = {
  requireAuth: true,
  applySecurityChecks: true,
  skipRateLimit: false,
};

export const POST = withValidation(
  IgnoreTargetSchema,
  ignoreHandler,
  validationOptions
);
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Schema for recruitment inbound data (e.g. from Typeform or Google Forms)
const recruitmentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  country: z.string().optional(),
  source: z.string().default('Direct'),
  languages: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate request
    const validatedData = recruitmentSchema.parse(body);

    // Create the lead in the database
    // We use a state machine approach, starting at 'Aplicante'
    const lead = await prisma.recruitmentCandidate.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        telefono: validatedData.phone,
        pais: validatedData.country,
        fuente: validatedData.source,
        status: 'Aplicante', 
        fechaPostulacion: new Date()
      }
    });

    // Notify Admins
    try {
      const admins = await prisma.userProfile.findMany({
        where: { role: 'admin' },
        select: { id: true }
      });

      const { createNotification } = await import('@/app/actions/notifications');
      
      await Promise.all(admins.map((admin: { id: string }) => 
        createNotification({
          userId: admin.id,
          title: 'New Applicant',
          message: `${validatedData.name} just applied from ${validatedData.source}.`,
          type: 'info',
          link: '/recruitment'
        })
      ));
    } catch (notifyErr) {
      console.error('Admin notification failed:', notifyErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Lead captured successfully',
      leadId: lead.id
    }, { status: 201 });


  } catch (error) {
    console.error('Recruitment Webhook Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.issues
      }, { status: 400 });
    }


    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { InterpreterSchema } from '@/lib/validators';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const interpreter = await prisma.interpreter.findUnique({
      where: { id },
    });

    if (!interpreter) {
      return NextResponse.json({ error: 'Interpreter not found' }, { status: 404 });
    }

    return NextResponse.json(interpreter);
  } catch (error: any) {
    console.error('Error fetching interpreter:', error);
    return NextResponse.json({ error: error.message || 'Error fetching interpreter' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    
    // Validate input (partial is fine for PUT/PATCH, but we'll use schema.partial() to allow partial updates)
    const validationResult = InterpreterSchema.partial().safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const updatedInterpreter = await prisma.interpreter.update({
      where: { id },
      data: validationResult.data,
    });

    return NextResponse.json(updatedInterpreter);
  } catch (error: any) {
    console.error('Error updating interpreter:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Interpreter not found' }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: `Interpreter with this ${error.meta?.target?.[0]} already exists.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || 'Error updating interpreter' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await prisma.interpreter.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Interpreter deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting interpreter:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Interpreter not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Error deleting interpreter' }, { status: 500 });
  }
}

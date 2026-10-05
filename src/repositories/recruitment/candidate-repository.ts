import prisma from '@/lib/prisma';

const db = prisma;

export const candidateRepository = {
  async findByEmail(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    return db.recruitmentCandidate.findUnique({
      where: { email: normalizedEmail },
    });
  },

  async findById(id: number) {
    return db.recruitmentCandidate.findUnique({
      where: { id },
    });
  },

  async create(data: {
    name: string;
    email: string;
    telefono?: string;
    pais?: string;
    fuente?: string;
    notas?: string;
    status?: string;
  }) {
    const normalizedEmail = data.email.toLowerCase().trim();
    return db.recruitmentCandidate.create({
      data: {
        ...data,
        email: normalizedEmail,
        status: data.status || 'Aplicante',
      },
    });
  },

  async update(id: number, data: Partial<{
    name: string;
    email: string;
    telefono: string | null;
    pais: string | null;
    fuente: string | null;
    englishLevel: string | null;
    speedtestMbps: number | null;
    status: string;
    fechaEntrevista: Date | null;
    resultRoleplay: number | null;
    fechaOferta: Date | null;
    fechaInicio: Date | null;
    responsable: string | null;
    notas: string | null;
  }>) {
    return db.recruitmentCandidate.update({
      where: { id },
      data,
    });
  },

  async findMany(filters: {
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
    orderBy?: 'fechaPostulacion' | 'createdAt';
    orderDir?: 'asc' | 'desc';
  }) {
    const { status, search, page = 1, pageSize = 20, orderBy = 'fechaPostulacion', orderDir = 'desc' } = filters;
    
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      db.recruitmentCandidate.findMany({
        where,
        orderBy: { [orderBy]: orderDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.recruitmentCandidate.count({ where }),
    ]);

    return { items, total, page, pageSize };
  },

  async countByStatus() {
    return db.recruitmentCandidate.groupBy({
      by: ['status'],
      _count: { status: true },
    });
  },
};
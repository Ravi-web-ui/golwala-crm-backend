import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

// Validation schema
const studentAdmissionSchema = z.object({
  // Personal Details
  surname: z.string().min(1),
  firstName: z.string().min(1),
  fatherName: z.string().min(1),
  motherName: z.string().min(1),
  surnameMr: z.string().optional(),
  firstNameMr: z.string().optional(),
  fatherNameMr: z.string().optional(),
  motherNameMr: z.string().optional(),
  nameAsPerAadhar: z.string().min(1),
  gender: z.string().min(1),
  aadharNo: z.string().length(12),
  maritalStatus: z.string().min(1),
  bloodGroup: z.string().min(1),
  dob: z.string(), // Will be converted to Date
  placeBirthCity: z.string().min(1),
  placeBirthTehsil: z.string().min(1),
  placeBirthState: z.string().min(1),
  placeBirthCountry: z.string().default("India"),
  nationality: z.string().default("Indian"),
  voterId: z.string().optional(),
  category: z.string().min(1),
  religion: z.string().min(1),
  caste: z.string().min(1),
  subCaste: z.string().optional(),
  motherTongue: z.string().min(1),
  differentlyAbled: z.string().default("No"),
  stream: z.string().min(1),
  abcId: z.string().min(1),
  prnErnNo: z.string().optional(),
  employmentStatus: z.string().optional(),
  
  // Address - Correspondence
  corrAddress: z.string().min(1),
  corrState: z.string().min(1),
  corrDistrict: z.string().min(1),
  corrPincode: z.string().length(6),
  corrCity: z.string().min(1),
  corrResidentialArea: z.string().optional(),
  
  // Address - Permanent
  permAddress: z.string().min(1),
  permState: z.string().min(1),
  permDistrict: z.string().min(1),
  permPincode: z.string().length(6),
  permCity: z.string().min(1),
  permResidentialArea: z.string().optional(),
  
  // Contact Details
  studentMobile: z.string().length(10),
  studentEmail: z.string().email(),
  parentMobile: z.string().length(10),
  parentEmail: z.string().email(),
  
  // Parent Details
  parentName: z.string().min(1),
  parentMotherName: z.string().min(1),
  annualIncome: z.number().optional(),
  occupation: z.string().min(1),
  officeAddress: z.string().optional(),
  
  // Documents & Media
  documents: z.any().optional(),
  photo: z.string().optional(),
  signature: z.string().optional(),
  
  // Declaration
  declarationAccepted: z.boolean(),
  
  // Education Details (array)
  education: z.array(z.object({
    examination: z.string().optional(),
    board: z.string().optional(),
    yearOfPassing: z.string().optional(),
    instituteName: z.string().optional(),
    seatNumber: z.string().optional(),
    obtainedMarks: z.number().optional(),
    maxMarks: z.number().optional(),
    percentage: z.number().optional(),
    grade: z.string().optional(),
  })).optional(),
  
  // Qualifying Subjects (array)
  qualifyingSubjects: z.array(z.object({
    subjectName: z.string().optional(),
    obtainedMarks: z.number().optional(),
    maxMarks: z.number().optional(),
  })).optional(),
  
  // Subjects Offered (array)
  subjectsOffered: z.array(z.object({
    srNo: z.number().optional(),
    groupName: z.string().optional(),
    subjectName: z.string().optional(),
  })).optional(),
});

// Generate application number
function generateApplicationNo(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `APP${year}${random}`;
}

// POST /api/student-admissions - Create new student admission
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = studentAdmissionSchema.parse(req.body);
    
    // Generate unique application number
    const applicationNo = generateApplicationNo();
    
    // Create admission with related records
    const admission = await prisma.studentAdmission.create({
      data: {
        applicationNo,
        surname: validatedData.surname,
        firstName: validatedData.firstName,
        fatherName: validatedData.fatherName,
        motherName: validatedData.motherName,
        surnameMr: validatedData.surnameMr,
        firstNameMr: validatedData.firstNameMr,
        fatherNameMr: validatedData.fatherNameMr,
        motherNameMr: validatedData.motherNameMr,
        nameAsPerAadhar: validatedData.nameAsPerAadhar,
        gender: validatedData.gender,
        aadharNo: validatedData.aadharNo,
        maritalStatus: validatedData.maritalStatus,
        bloodGroup: validatedData.bloodGroup,
        dob: new Date(validatedData.dob),
        placeBirthCity: validatedData.placeBirthCity,
        placeBirthTehsil: validatedData.placeBirthTehsil,
        placeBirthState: validatedData.placeBirthState,
        placeBirthCountry: validatedData.placeBirthCountry,
        nationality: validatedData.nationality,
        voterId: validatedData.voterId,
        category: validatedData.category,
        religion: validatedData.religion,
        caste: validatedData.caste,
        subCaste: validatedData.subCaste,
        motherTongue: validatedData.motherTongue,
        differentlyAbled: validatedData.differentlyAbled,
        stream: validatedData.stream,
        abcId: validatedData.abcId,
        prnErnNo: validatedData.prnErnNo,
        employmentStatus: validatedData.employmentStatus,
        corrAddress: validatedData.corrAddress,
        corrState: validatedData.corrState,
        corrDistrict: validatedData.corrDistrict,
        corrPincode: validatedData.corrPincode,
        corrCity: validatedData.corrCity,
        corrResidentialArea: validatedData.corrResidentialArea,
        permAddress: validatedData.permAddress,
        permState: validatedData.permState,
        permDistrict: validatedData.permDistrict,
        permPincode: validatedData.permPincode,
        permCity: validatedData.permCity,
        permResidentialArea: validatedData.permResidentialArea,
        studentMobile: validatedData.studentMobile,
        studentEmail: validatedData.studentEmail,
        parentMobile: validatedData.parentMobile,
        parentEmail: validatedData.parentEmail,
        parentName: validatedData.parentName,
        parentMotherName: validatedData.parentMotherName,
        annualIncome: validatedData.annualIncome,
        occupation: validatedData.occupation,
        officeAddress: validatedData.officeAddress,
        documents: validatedData.documents,
        photo: validatedData.photo,
        signature: validatedData.signature,
        declarationAccepted: validatedData.declarationAccepted,
        
        // Create related records
        education: validatedData.education ? {
          create: validatedData.education.map(edu => ({
            examination: edu.examination,
            board: edu.board,
            yearOfPassing: edu.yearOfPassing,
            instituteName: edu.instituteName,
            seatNumber: edu.seatNumber,
            obtainedMarks: edu.obtainedMarks,
            maxMarks: edu.maxMarks,
            percentage: edu.percentage,
            grade: edu.grade,
          }))
        } : undefined,
        
        qualifyingSubjects: validatedData.qualifyingSubjects ? {
          create: validatedData.qualifyingSubjects.map(sub => ({
            subjectName: sub.subjectName,
            obtainedMarks: sub.obtainedMarks,
            maxMarks: sub.maxMarks,
          }))
        } : undefined,
        
        subjectsOffered: validatedData.subjectsOffered ? {
          create: validatedData.subjectsOffered.map(sub => ({
            srNo: sub.srNo,
            groupName: sub.groupName,
            subjectName: sub.subjectName,
          }))
        } : undefined,
      },
      include: {
        education: true,
        qualifyingSubjects: true,
        subjectsOffered: true,
      },
    });
    
    res.status(201).json({
      success: true,
      message: "Student admission application submitted successfully",
      data: {
        applicationNo: admission.applicationNo,
        id: admission.id,
      },
    });
  } catch (error: any) {
    console.error("Error creating student admission:", error);
    
    if (error.name === "ZodError") {
      res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to submit admission application",
    });
  }
});

// GET /api/student-admissions - Get all admissions (for admin)
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, page = "1", limit = "50" } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    const where: any = {};
    if (status) where.status = status;
    
    const [admissions, total] = await Promise.all([
      prisma.studentAdmission.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          applicationNo: true,
          firstName: true,
          surname: true,
          studentEmail: true,
          studentMobile: true,
          stream: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.studentAdmission.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: admissions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching admissions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch admissions",
    });
  }
});

// GET /api/student-admissions/:id - Get single admission details
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const admission = await prisma.studentAdmission.findUnique({
      where: { id: parseInt(id as string) },
      include: {
        education: true,
        qualifyingSubjects: true,
        subjectsOffered: true,
      },
    });
    
    if (!admission) {
      res.status(404).json({
        success: false,
        error: "Admission not found",
      });
      return;
    }
    
    res.json({
      success: true,
      data: admission,
    });
  } catch (error) {
    console.error("Error fetching admission:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch admission details",
    });
  }
});

export default router;

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { auth } from "../middleware/auth";
import { notifyStudentAdmission } from "../services/notify";
import { generateStudentAdmissionPDF } from "../services/pdfGenerator";

const router = Router();
const prisma = new PrismaClient();

// Validation schema
const studentAdmissionSchema = z.object({
  // Program Selection (optional for backward compatibility)
  programCategory: z.string().optional(),
  programType: z.string().optional(),
  programName: z.string().optional(),
  
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
        programCategory: validatedData.programCategory,
        programType: validatedData.programType,
        programName: validatedData.programName,
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

    // Return success response immediately
    res.status(201).json({
      success: true,
      data: {
        applicationNo: admission.applicationNo,
        id: admission.id,
      },
      message: "Application submitted successfully. Confirmation email will be sent shortly.",
    });

    // Send email notifications with PDF asynchronously (in background)
    // This runs after the response is sent, so user doesn't wait
    setImmediate(async () => {
      try {
        console.log(`[ASYNC EMAIL] Starting email process for application ${admission.applicationNo}`);
        
        // Generate PDF
        const pdfBuffer = await generateStudentAdmissionPDF({
          applicationNo: admission.applicationNo || "",
          programCategory: admission.programCategory || undefined,
          programType: admission.programType || undefined,
          programName: admission.programName || undefined,
          surname: admission.surname,
          firstName: admission.firstName,
          fatherName: admission.fatherName,
          motherName: admission.motherName,
          surnameMr: admission.surnameMr || undefined,
          firstNameMr: admission.firstNameMr || undefined,
          fatherNameMr: admission.fatherNameMr || undefined,
          motherNameMr: admission.motherNameMr || undefined,
          nameAsPerAadhar: admission.nameAsPerAadhar,
          gender: admission.gender,
          aadharNo: admission.aadharNo,
          maritalStatus: admission.maritalStatus,
          bloodGroup: admission.bloodGroup,
          dob: admission.dob,
          placeBirthCity: admission.placeBirthCity,
          placeBirthTehsil: admission.placeBirthTehsil,
          placeBirthState: admission.placeBirthState,
          placeBirthCountry: admission.placeBirthCountry,
          nationality: admission.nationality,
          voterId: admission.voterId || undefined,
          category: admission.category,
          religion: admission.religion,
          caste: admission.caste,
          subCaste: admission.subCaste || undefined,
          motherTongue: admission.motherTongue,
          differentlyAbled: admission.differentlyAbled,
          stream: admission.stream,
          abcId: admission.abcId,
          prnErnNo: admission.prnErnNo || undefined,
          employmentStatus: admission.employmentStatus || undefined,
          corrAddress: admission.corrAddress,
          corrState: admission.corrState,
          corrDistrict: admission.corrDistrict,
          corrPincode: admission.corrPincode,
          corrCity: admission.corrCity,
          corrResidentialArea: admission.corrResidentialArea || undefined,
          permAddress: admission.permAddress,
          permState: admission.permState,
          permDistrict: admission.permDistrict,
          permPincode: admission.permPincode,
          permCity: admission.permCity,
          permResidentialArea: admission.permResidentialArea || undefined,
          studentMobile: admission.studentMobile,
          studentEmail: admission.studentEmail,
          parentMobile: admission.parentMobile,
          parentEmail: admission.parentEmail,
          parentName: admission.parentName,
          parentMotherName: admission.parentMotherName,
          annualIncome: admission.annualIncome ? Number(admission.annualIncome) : undefined,
          occupation: admission.occupation,
          officeAddress: admission.officeAddress || undefined,
          photo: admission.photo || undefined,
          signature: admission.signature || undefined,
          education: admission.education.map(edu => ({
            examination: edu.examination || undefined,
            board: edu.board || undefined,
            yearOfPassing: edu.yearOfPassing || undefined,
            instituteName: edu.instituteName || undefined,
            seatNumber: edu.seatNumber || undefined,
            obtainedMarks: edu.obtainedMarks ? Number(edu.obtainedMarks) : undefined,
            maxMarks: edu.maxMarks ? Number(edu.maxMarks) : undefined,
            percentage: edu.percentage ? Number(edu.percentage) : undefined,
            grade: edu.grade || undefined,
          })),
          qualifyingSubjects: admission.qualifyingSubjects.map(sub => ({
            subjectName: sub.subjectName || undefined,
            obtainedMarks: sub.obtainedMarks ? Number(sub.obtainedMarks) : undefined,
            maxMarks: sub.maxMarks ? Number(sub.maxMarks) : undefined,
          })),
          subjectsOffered: admission.subjectsOffered.map(sub => ({
            srNo: sub.srNo || undefined,
            groupName: sub.groupName || undefined,
            subjectName: sub.subjectName || undefined,
          })),
        });

        console.log(`[ASYNC EMAIL] PDF generated for application ${admission.applicationNo}`);

        // Get admin emails - only notify admins assigned to this program
        let adminEmails: string[] = [];
        
        // Always notify super_admin
        const superAdmins = await prisma.adminUser.findMany({
          where: { role: "super_admin" },
          select: { email: true },
        });
        
        adminEmails = superAdmins
          .map((a: { email: string | null }) => a.email)
          .filter((email: string | null): email is string => email !== null && email !== "");

        // If programName exists, find admins assigned to this program
        if (admission.programName) {
          const assignedAdmins = await prisma.adminUser.findMany({
            where: {
              role: "admin",
              programAssignments: {
                some: {
                  OR: [
                    { program: admission.programName },
                    { program: admission.stream },
                  ],
                },
              },
            },
            select: { email: true },
          });

          const assignedEmails = assignedAdmins
            .map((a: { email: string | null }) => a.email)
            .filter((email: string | null): email is string => email !== null && email !== "");

          adminEmails = [...adminEmails, ...assignedEmails];
        } else {
          // Fallback: if no programName, find admins assigned to this stream
          const assignedAdmins = await prisma.adminUser.findMany({
            where: {
              role: "admin",
              programAssignments: {
                some: {
                  program: admission.stream,
                },
              },
            },
            select: { email: true },
          });

          const assignedEmails = assignedAdmins
            .map((a: { email: string | null }) => a.email)
            .filter((email: string | null): email is string => email !== null && email !== "");

          adminEmails = [...adminEmails, ...assignedEmails];
        }

        // Remove duplicates
        adminEmails = [...new Set(adminEmails)];
        
        console.log(`[ASYNC EMAIL] Found ${adminEmails.length} admin(s) to notify for application ${admission.applicationNo}`);

        // Send notifications with PDF to admins
        if (adminEmails.length > 0) {
          await notifyStudentAdmission(
            {
              applicationNo: admission.applicationNo || "",
              firstName: admission.firstName,
              surname: admission.surname,
              fatherName: admission.fatherName,
              motherName: admission.motherName,
              studentEmail: admission.studentEmail,
              studentMobile: admission.studentMobile,
              parentMobile: admission.parentMobile,
              stream: admission.stream,
              dob: admission.dob,
              gender: admission.gender,
              category: admission.category,
              corrCity: admission.corrCity,
            },
            adminEmails,
            pdfBuffer
          );
        }
        
        console.log(`[ASYNC EMAIL] Successfully sent emails for application ${admission.applicationNo}`);
      } catch (emailError: any) {
        // Log email error but application is already saved
        console.error(`[ASYNC EMAIL] Error sending admission emails for ${admission.applicationNo}:`, emailError.message);
      }
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
router.get("/", auth, async (req: any, res: Response): Promise<void> => {
  try {
    const { status, page = "1", limit = "50", search } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    const where: any = {};
    
    // Status filter
    if (status) where.status = status;
    
    // Search functionality
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { applicationNo: { contains: searchTerm, mode: 'insensitive' } },
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { surname: { contains: searchTerm, mode: 'insensitive' } },
        { studentEmail: { contains: searchTerm, mode: 'insensitive' } },
        { studentMobile: { contains: searchTerm } },
      ];
    }
    
    // Role-based access restriction:
    // - super_admin: sees ALL applications (no filtering)
    // - manager: sees ALL applications (no filtering)
    // - admin: sees ONLY assigned program applications
    if (req.user?.role === "admin") {
      const assignments = await prisma.programAssignment.findMany({ 
        where: { adminId: req.user!.id } 
      });
      
      if (assignments.length > 0) {
        const programs = assignments.map((a: any) => a.program);
        
        // Add program filtering using AND condition to combine with existing filters
        const programFilter = {
          OR: [
            { stream: { in: programs } },
            { programName: { in: programs } }
          ]
        };
        
        // If there's already an OR condition (from search), we need to combine them with AND
        if (where.OR) {
          const searchOR = where.OR;
          delete where.OR;
          where.AND = [
            { OR: searchOR },
            programFilter
          ];
        } else {
          // No search, just add program filter directly
          where.OR = programFilter.OR;
        }
      } else {
        // Admin has no program assignments - show nothing
        where.id = -1;
      }
    }
    
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
          programName: true,
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

// GET /api/student-admissions/stats - Get admission statistics
router.get("/stats", auth, async (req: any, res: Response): Promise<void> => {
  try {
    const baseWhere: any = {};
    
    // Role-based access restriction:
    // - super_admin: sees ALL applications
    // - manager: sees ALL applications
    // - admin: sees ONLY assigned program applications
    if (req.user?.role === "admin") {
      const assignments = await prisma.programAssignment.findMany({ 
        where: { adminId: req.user!.id } 
      });
      
      if (assignments.length > 0) {
        const programs = assignments.map((a: any) => a.program);
        baseWhere.OR = [
          { stream: { in: programs } },
          { programName: { in: programs } }
        ];
      } else {
        // Admin has no program assignments - show zero stats
        baseWhere.id = -1;
      }
    }
    
    const [total, newCount, underReview, approved, rejected, admissionDone] = await Promise.all([
      prisma.studentAdmission.count({ where: baseWhere }),
      prisma.studentAdmission.count({ where: { ...baseWhere, status: "new" } }),
      prisma.studentAdmission.count({ where: { ...baseWhere, status: "under_review" } }),
      prisma.studentAdmission.count({ where: { ...baseWhere, status: "approved" } }),
      prisma.studentAdmission.count({ where: { ...baseWhere, status: "rejected" } }),
      prisma.studentAdmission.count({ where: { ...baseWhere, status: "admission_done" } }),
    ]);
    
    res.json({
      success: true,
      data: {
        total,
        new: newCount,
        under_review: underReview,
        approved,
        rejected,
        admission_done: admissionDone,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch statistics",
    });
  }
});

// GET /api/student-admissions/:id - Get single admission details
router.get("/:id", auth, async (req: Request, res: Response): Promise<void> => {
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

// PATCH /api/student-admissions/:id/status - Update admission status
router.patch("/:id/status", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ["new", "under_review", "approved", "rejected", "admission_done"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: "Invalid status value",
      });
      return;
    }
    
    const admission = await prisma.studentAdmission.update({
      where: { id: parseInt(id as string) },
      data: { status },
    });
    
    res.json({
      success: true,
      message: "Status updated successfully",
      data: admission,
    });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update status",
    });
  }
});

// DELETE /api/student-admissions/:id - Delete admission
router.delete("/:id", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    await prisma.studentAdmission.delete({
      where: { id: parseInt(id as string) },
    });
    
    res.json({
      success: true,
      message: "Admission deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting admission:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete admission",
    });
  }
});

// GET /api/student-admissions/:id/pdf - Get PDF for admission
router.get("/:id/pdf", auth, async (req: Request, res: Response): Promise<void> => {
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
    
    // Generate PDF
    const pdfBuffer = await generateStudentAdmissionPDF({
      applicationNo: admission.applicationNo || "",
      programCategory: admission.programCategory || undefined,
      programType: admission.programType || undefined,
      programName: admission.programName || undefined,
      surname: admission.surname,
      firstName: admission.firstName,
      fatherName: admission.fatherName,
      motherName: admission.motherName,
      surnameMr: admission.surnameMr || undefined,
      firstNameMr: admission.firstNameMr || undefined,
      fatherNameMr: admission.fatherNameMr || undefined,
      motherNameMr: admission.motherNameMr || undefined,
      nameAsPerAadhar: admission.nameAsPerAadhar,
      gender: admission.gender,
      aadharNo: admission.aadharNo,
      maritalStatus: admission.maritalStatus,
      bloodGroup: admission.bloodGroup,
      dob: admission.dob,
      placeBirthCity: admission.placeBirthCity,
      placeBirthTehsil: admission.placeBirthTehsil,
      placeBirthState: admission.placeBirthState,
      placeBirthCountry: admission.placeBirthCountry,
      nationality: admission.nationality,
      voterId: admission.voterId || undefined,
      category: admission.category,
      religion: admission.religion,
      caste: admission.caste,
      subCaste: admission.subCaste || undefined,
      motherTongue: admission.motherTongue,
      differentlyAbled: admission.differentlyAbled,
      stream: admission.stream,
      abcId: admission.abcId,
      prnErnNo: admission.prnErnNo || undefined,
      employmentStatus: admission.employmentStatus || undefined,
      corrAddress: admission.corrAddress,
      corrState: admission.corrState,
      corrDistrict: admission.corrDistrict,
      corrPincode: admission.corrPincode,
      corrCity: admission.corrCity,
      corrResidentialArea: admission.corrResidentialArea || undefined,
      permAddress: admission.permAddress,
      permState: admission.permState,
      permDistrict: admission.permDistrict,
      permPincode: admission.permPincode,
      permCity: admission.permCity,
      permResidentialArea: admission.permResidentialArea || undefined,
      studentMobile: admission.studentMobile,
      studentEmail: admission.studentEmail,
      parentMobile: admission.parentMobile,
      parentEmail: admission.parentEmail,
      parentName: admission.parentName,
      parentMotherName: admission.parentMotherName,
      annualIncome: admission.annualIncome ? Number(admission.annualIncome) : undefined,
      occupation: admission.occupation,
      officeAddress: admission.officeAddress || undefined,
      education: admission.education.map(edu => ({
        examination: edu.examination || undefined,
        board: edu.board || undefined,
        yearOfPassing: edu.yearOfPassing || undefined,
        instituteName: edu.instituteName || undefined,
        seatNumber: edu.seatNumber || undefined,
        obtainedMarks: edu.obtainedMarks ? Number(edu.obtainedMarks) : undefined,
        maxMarks: edu.maxMarks ? Number(edu.maxMarks) : undefined,
        percentage: edu.percentage ? Number(edu.percentage) : undefined,
        grade: edu.grade || undefined,
      })),
      qualifyingSubjects: admission.qualifyingSubjects.map(sub => ({
        subjectName: sub.subjectName || undefined,
        obtainedMarks: sub.obtainedMarks ? Number(sub.obtainedMarks) : undefined,
        maxMarks: sub.maxMarks ? Number(sub.maxMarks) : undefined,
      })),
      subjectsOffered: admission.subjectsOffered.map(sub => ({
        srNo: sub.srNo || undefined,
        groupName: sub.groupName || undefined,
        subjectName: sub.subjectName || undefined,
      })),
      photo: admission.photo || undefined,
      signature: admission.signature || undefined,
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Application-${admission.applicationNo}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate PDF",
    });
  }
});

export default router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const notify_1 = require("../services/notify");
const pdfGenerator_1 = require("../services/pdfGenerator");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Validation schema
const studentAdmissionSchema = zod_1.z.object({
    // Personal Details
    surname: zod_1.z.string().min(1),
    firstName: zod_1.z.string().min(1),
    fatherName: zod_1.z.string().min(1),
    motherName: zod_1.z.string().min(1),
    surnameMr: zod_1.z.string().optional(),
    firstNameMr: zod_1.z.string().optional(),
    fatherNameMr: zod_1.z.string().optional(),
    motherNameMr: zod_1.z.string().optional(),
    nameAsPerAadhar: zod_1.z.string().min(1),
    gender: zod_1.z.string().min(1),
    aadharNo: zod_1.z.string().length(12),
    maritalStatus: zod_1.z.string().min(1),
    bloodGroup: zod_1.z.string().min(1),
    dob: zod_1.z.string(), // Will be converted to Date
    placeBirthCity: zod_1.z.string().min(1),
    placeBirthTehsil: zod_1.z.string().min(1),
    placeBirthState: zod_1.z.string().min(1),
    placeBirthCountry: zod_1.z.string().default("India"),
    nationality: zod_1.z.string().default("Indian"),
    voterId: zod_1.z.string().optional(),
    category: zod_1.z.string().min(1),
    religion: zod_1.z.string().min(1),
    caste: zod_1.z.string().min(1),
    subCaste: zod_1.z.string().optional(),
    motherTongue: zod_1.z.string().min(1),
    differentlyAbled: zod_1.z.string().default("No"),
    stream: zod_1.z.string().min(1),
    abcId: zod_1.z.string().min(1),
    prnErnNo: zod_1.z.string().optional(),
    employmentStatus: zod_1.z.string().optional(),
    // Address - Correspondence
    corrAddress: zod_1.z.string().min(1),
    corrState: zod_1.z.string().min(1),
    corrDistrict: zod_1.z.string().min(1),
    corrPincode: zod_1.z.string().length(6),
    corrCity: zod_1.z.string().min(1),
    corrResidentialArea: zod_1.z.string().optional(),
    // Address - Permanent
    permAddress: zod_1.z.string().min(1),
    permState: zod_1.z.string().min(1),
    permDistrict: zod_1.z.string().min(1),
    permPincode: zod_1.z.string().length(6),
    permCity: zod_1.z.string().min(1),
    permResidentialArea: zod_1.z.string().optional(),
    // Contact Details
    studentMobile: zod_1.z.string().length(10),
    studentEmail: zod_1.z.string().email(),
    parentMobile: zod_1.z.string().length(10),
    parentEmail: zod_1.z.string().email(),
    // Parent Details
    parentName: zod_1.z.string().min(1),
    parentMotherName: zod_1.z.string().min(1),
    annualIncome: zod_1.z.number().optional(),
    occupation: zod_1.z.string().min(1),
    officeAddress: zod_1.z.string().optional(),
    // Documents & Media
    documents: zod_1.z.any().optional(),
    photo: zod_1.z.string().optional(),
    signature: zod_1.z.string().optional(),
    // Declaration
    declarationAccepted: zod_1.z.boolean(),
    // Education Details (array)
    education: zod_1.z.array(zod_1.z.object({
        examination: zod_1.z.string().optional(),
        board: zod_1.z.string().optional(),
        yearOfPassing: zod_1.z.string().optional(),
        instituteName: zod_1.z.string().optional(),
        seatNumber: zod_1.z.string().optional(),
        obtainedMarks: zod_1.z.number().optional(),
        maxMarks: zod_1.z.number().optional(),
        percentage: zod_1.z.number().optional(),
        grade: zod_1.z.string().optional(),
    })).optional(),
    // Qualifying Subjects (array)
    qualifyingSubjects: zod_1.z.array(zod_1.z.object({
        subjectName: zod_1.z.string().optional(),
        obtainedMarks: zod_1.z.number().optional(),
        maxMarks: zod_1.z.number().optional(),
    })).optional(),
    // Subjects Offered (array)
    subjectsOffered: zod_1.z.array(zod_1.z.object({
        srNo: zod_1.z.number().optional(),
        groupName: zod_1.z.string().optional(),
        subjectName: zod_1.z.string().optional(),
    })).optional(),
});
// Generate application number
function generateApplicationNo() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `APP${year}${random}`;
}
// POST /api/student-admissions - Create new student admission
router.post("/", async (req, res) => {
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
        // Send email notifications with PDF
        try {
            // Generate PDF
            const pdfBuffer = await (0, pdfGenerator_1.generateStudentAdmissionPDF)({
                applicationNo: admission.applicationNo || "",
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
            });
            // Get admin emails (super_admin and admin roles)
            const admins = await prisma.adminUser.findMany({
                where: {
                    role: { in: ["super_admin", "admin"] },
                },
                select: { email: true },
            });
            const adminEmails = admins
                .map((a) => a.email)
                .filter((email) => email !== null && email !== "");
            // Send notifications with PDF
            await (0, notify_1.notifyStudentAdmission)({
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
            }, adminEmails, pdfBuffer);
        }
        catch (emailError) {
            // Log email error but don't fail the request
            console.error("Error sending admission emails:", emailError.message);
        }
        res.status(201).json({
            success: true,
            message: "Student admission application submitted successfully",
            data: {
                applicationNo: admission.applicationNo,
                id: admission.id,
            },
        });
    }
    catch (error) {
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
router.get("/", async (req, res) => {
    try {
        const { status, page = "1", limit = "50" } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (status)
            where.status = status;
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
    }
    catch (error) {
        console.error("Error fetching admissions:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch admissions",
        });
    }
});
// GET /api/student-admissions/:id - Get single admission details
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const admission = await prisma.studentAdmission.findUnique({
            where: { id: parseInt(id) },
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
    }
    catch (error) {
        console.error("Error fetching admission:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch admission details",
        });
    }
});
exports.default = router;

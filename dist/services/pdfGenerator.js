"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStudentAdmissionPDF = generateStudentAdmissionPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Convert base64 image to Buffer for PDFKit
 * Handles data URLs and plain base64 strings (no Sharp dependency)
 */
function convertImageToBuffer(base64Data) {
    try {
        let imageBuffer;
        // Extract base64 data from data URL if present
        if (base64Data.startsWith('data:image')) {
            const base64String = base64Data.split(',')[1];
            imageBuffer = Buffer.from(base64String, 'base64');
        }
        else if (base64Data.startsWith('/') || base64Data.includes(':\\')) {
            // File path
            imageBuffer = fs_1.default.readFileSync(base64Data);
        }
        else {
            // Assume it's already base64 without prefix
            imageBuffer = Buffer.from(base64Data, 'base64');
        }
        return imageBuffer;
    }
    catch (error) {
        console.error('Error converting image:', error.message);
        throw error;
    }
}
async function generateStudentAdmissionPDF(data) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({
                size: "A4",
                margin: 40,
                bufferPages: true
            });
            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);
            // Register Devanagari font for Marathi text (currently disabled - font rendering issue)
            const devanagariFont = path_1.default.join(process.cwd(), "src", "fonts", "NotoSansDevanagari-Regular.ttf");
            let hasDevanagariFont = false;
            if (fs_1.default.existsSync(devanagariFont)) {
                doc.registerFont("Devanagari", devanagariFont, "Noto Sans Devanagari");
                hasDevanagariFont = true;
            }
            // Helper to check if we should use Devanagari font
            const useDevanagariFont = (text) => hasDevanagariFont && hasDevanagari(text);
            // Helper function to detect if text contains Devanagari characters
            function hasDevanagari(text) {
                // Devanagari Unicode range: U+0900 to U+097F
                return /[\u0900-\u097F]/.test(text);
            }
            // College Logo (Top Center - 150px width, auto height) - Outside the box
            const logoPath = path_1.default.join(process.cwd(), "..", "public", "images", "rav-logo-new-logo.png");
            if (fs_1.default.existsSync(logoPath)) {
                try {
                    // Center the logo at top (297.5 - 75 = 222.5 center point for 150px width)
                    // Auto height maintains aspect ratio
                    doc.image(logoPath, 222.5, 40, { width: 150, align: 'center' });
                }
                catch (err) {
                    console.error('Error loading logo:', err);
                }
            }
            else {
                console.error('Logo not found at:', logoPath);
            }
            // Professional Header with Border (moved up and increased height)
            doc.strokeColor("#cccccc").lineWidth(1); // Light gray border
            doc.rect(40, 135, 515, 140).stroke(); // Moved from 150 to 135, height from 120 to 140
            doc.strokeColor("#000000"); // Reset to black for text
            // College Name and Details (Centered, Full Width)
            doc
                .fontSize(16)
                .fillColor("#8B0000")
                .font("Helvetica-Bold")
                .text("LAXMICHAND GOLWALA COLLEGE OF", 40, 145, { align: "center", width: 515 })
                .text("COMMERCE & ECONOMICS", 40, 163, { align: "center", width: 515 })
                .fontSize(9)
                .fillColor("#000")
                .font("Helvetica-Oblique")
                .text("Empowered Autonomous Status", 40, 185, { align: "center", width: 515 })
                .fontSize(8)
                .font("Helvetica")
                .text("Conducted by Sheth Laxmichand Golwala Charitable Trust, Mumbai", 40, 200, { align: "center", width: 515 })
                .text("(Affiliated to University of Mumbai)", 40, 213, { align: "center", width: 515 })
                .text("Reaccredited by NAAC | ISO 9001:2015 Certified", 40, 226, { align: "center", width: 515 })
                .fontSize(10)
                .fillColor("#8B0000")
                .font("Helvetica-Bold")
                .text("Application for Admission — Academic Year 2027-2028", 40, 250, { align: "center", width: 515 });
            // Photo Box (Right side of header - passport size)
            doc.strokeColor("#000000").lineWidth(1.5);
            doc.rect(475, 140, 70, 90).stroke();
            // Display photo if provided
            if (data.photo) {
                try {
                    // Convert image to Buffer for PDFKit
                    const imageBuffer = convertImageToBuffer(data.photo);
                    // Fit image properly within the box with slight padding
                    doc.image(imageBuffer, 476, 141, {
                        width: 68,
                        height: 88,
                        fit: [68, 88],
                        align: 'center',
                        valign: 'center'
                    });
                }
                catch (err) {
                    console.error('Error loading photo:', err.message);
                    // Show placeholder text only if image fails
                    doc.fontSize(8).fillColor("#999").font("Helvetica")
                        .text("Photo", 480, 175, { width: 60, align: "center" })
                        .text("Error", 480, 185, { width: 60, align: "center" });
                }
            }
            else {
                // Show placeholder only if no photo provided
                doc.fontSize(8).fillColor("#999").font("Helvetica")
                    .text("Passport", 480, 175, { width: 60, align: "center" })
                    .text("Photo", 480, 185, { width: 60, align: "center" });
            }
            // Signature Box (Right side, below photo)
            doc.strokeColor("#000000").lineWidth(1.5);
            doc.rect(475, 235, 70, 35).stroke();
            // Display signature if provided
            if (data.signature) {
                try {
                    // Convert signature to Buffer for PDFKit
                    const signatureBuffer = convertImageToBuffer(data.signature);
                    // Fit signature properly within the box with slight padding
                    doc.image(signatureBuffer, 476, 236, {
                        width: 68,
                        height: 33,
                        fit: [68, 33],
                        align: 'center',
                        valign: 'center'
                    });
                }
                catch (err) {
                    console.error('Error loading signature:', err.message);
                    // Show placeholder text only if signature fails
                    doc.fontSize(7).fillColor("#999").font("Helvetica")
                        .text("Signature", 480, 248, { width: 60, align: "center" })
                        .text("Error", 480, 258, { width: 60, align: "center" });
                }
            }
            else {
                // Show placeholder only if no signature provided
                doc.fontSize(7).fillColor("#999").font("Helvetica")
                    .text("Signature of", 480, 245, { width: 60, align: "center" })
                    .text("Student", 480, 255, { width: 60, align: "center" });
            }
            // Application Number Box
            doc.strokeColor("#cccccc").lineWidth(1); // Light gray border
            doc.rect(40, 285, 515, 30).fillAndStroke("#f5f5f5", "#cccccc");
            doc.strokeColor("#000000"); // Reset to black
            doc
                .fontSize(14)
                .fillColor("#8B0000")
                .font("Helvetica-Bold")
                .text(`Application Form No: ${data.applicationNo}`, 40, 295, { align: "center", width: 515 });
            let yPos = 330;
            // Program Selection (ONLY show if programName exists - not stream)
            // This ensures old applications without program selection don't show this section
            if (data.programName) {
                yPos = addSectionHeader(doc, "ADMISSION FOR", yPos);
                yPos = addFullWidthRow(doc, "Program", data.programName, yPos);
                yPos += 15; // Gap after program section
            }
            // Section 1: Personal Details
            yPos = addSectionHeader(doc, "PERSONAL DETAILS", yPos);
            yPos = addTableRow(doc, "Surname", data.surname, "First Name", data.firstName, yPos);
            yPos = addTableRow(doc, "Father's Name", data.fatherName, "Mother's Name", data.motherName, yPos);
            // Marathi names are hidden from PDF (data is still stored in database)
            // if (data.surnameMr || data.firstNameMr || data.fatherNameMr || data.motherNameMr) {
            //   if (data.surnameMr || data.firstNameMr) {
            //     yPos = addTableRow(doc, "Surname (Marathi)", data.surnameMr || "-", "First Name (Marathi)", data.firstNameMr || "-", yPos);
            //   }
            //   if (data.fatherNameMr || data.motherNameMr) {
            //     yPos = addTableRow(doc, "Father's Name (Marathi)", data.fatherNameMr || "-", "Mother's Name (Marathi)", data.motherNameMr || "-", yPos);
            //   }
            // }
            yPos = addTableRow(doc, "Name as per Aadhar", data.nameAsPerAadhar, "Gender", data.gender, yPos);
            yPos = addTableRow(doc, "Date of Birth", new Date(data.dob).toLocaleDateString("en-IN"), "Blood Group", data.bloodGroup, yPos);
            yPos = addTableRow(doc, "Aadhar Number", data.aadharNo, "Marital Status", data.maritalStatus, yPos);
            yPos = addTableRow(doc, "Category", data.category, "Religion", data.religion, yPos);
            yPos = addTableRow(doc, "Caste", data.caste, "Mother Tongue", data.motherTongue, yPos);
            yPos = addTableRow(doc, "Nationality", data.nationality, "Differently Abled", data.differentlyAbled, yPos);
            yPos += 15; // Increased gap between sections
            // Section 2: Place of Birth
            yPos = addSectionHeader(doc, "PLACE OF BIRTH", yPos);
            yPos = addTableRow(doc, "City", data.placeBirthCity, "Tehsil", data.placeBirthTehsil, yPos);
            yPos = addTableRow(doc, "State", data.placeBirthState, "Country", data.placeBirthCountry, yPos);
            yPos += 15; // Increased gap between sections
            // Section 3: Academic Details
            yPos = addSectionHeader(doc, "ACADEMIC DETAILS", yPos);
            yPos = addTableRow(doc, "Stream", data.stream, "ABC ID", data.abcId, yPos);
            if (data.prnErnNo) {
                yPos = addTableRow(doc, "PRN/ERN No", data.prnErnNo, "Employment Status", data.employmentStatus || "No", yPos);
            }
            yPos += 15; // Increased gap between sections
            // Check if we need a new page (only if really needed - allow more content on page 1)
            if (yPos > 680) {
                doc.addPage();
                yPos = 40;
            }
            // Section 4: Correspondence Address
            yPos = addSectionHeader(doc, "CORRESPONDENCE ADDRESS", yPos);
            yPos = addFullWidthRow(doc, "Address", data.corrAddress, yPos);
            yPos = addTableRow(doc, "City", data.corrCity, "District", data.corrDistrict, yPos);
            yPos = addTableRow(doc, "State", data.corrState, "Pincode", data.corrPincode, yPos);
            yPos += 15; // Increased gap between sections
            // Check if we need a new page before Permanent Address section
            if (yPos > 680) {
                doc.addPage();
                yPos = 40;
            }
            // Section 5: Permanent Address
            yPos = addSectionHeader(doc, "PERMANENT ADDRESS", yPos);
            yPos = addFullWidthRow(doc, "Address", data.permAddress, yPos);
            yPos = addTableRow(doc, "City", data.permCity, "District", data.permDistrict, yPos);
            yPos = addTableRow(doc, "State", data.permState, "Pincode", data.permPincode, yPos);
            yPos += 15; // Increased gap between sections
            // Check if we need a new page before Contact Details section
            if (yPos > 680) {
                doc.addPage();
                yPos = 40;
            }
            // Section 6: Contact Details
            yPos = addSectionHeader(doc, "CONTACT DETAILS", yPos);
            yPos = addTableRow(doc, "Student Mobile", data.studentMobile, "Student Email", data.studentEmail, yPos);
            yPos = addTableRow(doc, "Parent Mobile", data.parentMobile, "Parent Email", data.parentEmail, yPos);
            yPos += 15; // Increased gap between sections
            // Section 7: Parent/Guardian Details
            yPos = addSectionHeader(doc, "PARENT/GUARDIAN DETAILS", yPos);
            yPos = addTableRow(doc, "Father/Guardian Name", data.parentName, "Mother Name", data.parentMotherName, yPos);
            yPos = addTableRow(doc, "Occupation", data.occupation, "Annual Income", data.annualIncome ? `Rs. ${data.annualIncome.toLocaleString("en-IN")}` : "-", yPos);
            if (data.officeAddress) {
                yPos = addFullWidthRow(doc, "Office Address", data.officeAddress, yPos);
            }
            yPos += 15; // Increased gap between sections
            // Education Details
            if (data.education && data.education.length > 0) {
                if (yPos > 600) {
                    doc.addPage();
                    yPos = 40;
                }
                yPos = addSectionHeader(doc, "EDUCATION DETAILS", yPos);
                yPos += 10; // Add gap after section header
                data.education.forEach((edu, index) => {
                    if (edu.examination) {
                        if (yPos > 700) {
                            doc.addPage();
                            yPos = 40;
                        }
                        doc.fontSize(10).fillColor("#000").font("Helvetica-Bold")
                            .text(`${index + 1}. ${edu.examination}`, 50, yPos);
                        yPos += 15;
                        if (edu.board)
                            yPos = addTableRow(doc, "Board", edu.board, "Year", edu.yearOfPassing || "-", yPos);
                        if (edu.instituteName)
                            yPos = addFullWidthRow(doc, "Institute", edu.instituteName, yPos);
                        if (edu.obtainedMarks)
                            yPos = addTableRow(doc, "Marks", `${edu.obtainedMarks}/${edu.maxMarks}`, "Percentage", edu.percentage ? `${edu.percentage}%` : "-", yPos);
                        yPos += 10; // Gap between education entries
                    }
                });
            }
            // Last Qualifying Subject Details (Optional - only if data exists)
            if (data.qualifyingSubjects && data.qualifyingSubjects.length > 0 && data.qualifyingSubjects.some(s => s.subjectName)) {
                if (yPos > 650) {
                    doc.addPage();
                    yPos = 40;
                }
                yPos += 15; // Gap before section
                yPos = addSectionHeader(doc, "LAST QUALIFYING SUBJECT DETAILS", yPos);
                yPos += 10;
                data.qualifyingSubjects.forEach((sub, index) => {
                    if (sub.subjectName) {
                        if (yPos > 720) {
                            doc.addPage();
                            yPos = 40;
                        }
                        doc.fontSize(10).fillColor("#000").font("Helvetica-Bold")
                            .text(`${index + 1}. ${sub.subjectName}`, 50, yPos);
                        yPos += 15;
                        if (sub.obtainedMarks && sub.maxMarks) {
                            yPos = addTableRow(doc, "Obtained Marks", sub.obtainedMarks.toString(), "Maximum Marks", sub.maxMarks.toString(), yPos);
                        }
                        yPos += 10;
                    }
                });
            }
            // Subjects Offered (Optional - only if data exists)
            if (data.subjectsOffered && data.subjectsOffered.length > 0 && data.subjectsOffered.some(s => s.subjectName)) {
                if (yPos > 650) {
                    doc.addPage();
                    yPos = 40;
                }
                yPos += 15; // Gap before section
                yPos = addSectionHeader(doc, "SUBJECTS OFFERED", yPos);
                yPos += 10;
                data.subjectsOffered.forEach((sub, index) => {
                    if (sub.subjectName) {
                        if (yPos > 740) {
                            doc.addPage();
                            yPos = 40;
                        }
                        const groupText = sub.groupName ? `${sub.groupName} - ` : "";
                        doc.fontSize(9).fillColor("#000").font("Helvetica")
                            .text(`${index + 1}. ${groupText}${sub.subjectName}`, 50, yPos);
                        yPos += 15;
                    }
                });
            }
            // List of Documents
            if (yPos > 650) {
                doc.addPage();
                yPos = 40;
            }
            yPos += 15;
            yPos = addSectionHeader(doc, "LIST OF DOCUMENTS", yPos);
            yPos += 10;
            const documentsList = [
                "X Marksheet",
                "XII Marksheet",
                "ABC ID Certificate",
                "Aadhar Card",
                "Transfer / Migration Certificate",
                "HSC Leaving Certificate",
                "Caste Validity Certificate (if applicable)",
                "Non Creamy Layer Certificate (if applicable)",
                "Disability Certificate (if applicable)",
            ];
            documentsList.forEach((doc_name, index) => {
                if (yPos > 750) {
                    doc.addPage();
                    yPos = 40;
                }
                doc.fontSize(9).fillColor("#000").font("Helvetica")
                    .text(`${index + 1}. ${doc_name}`, 50, yPos);
                yPos += 15;
            });
            // Declaration Section
            if (yPos > 500) {
                doc.addPage();
                yPos = 40;
            }
            yPos += 20;
            yPos = addSectionHeader(doc, "DECLARATION BY STUDENT", yPos);
            yPos += 10;
            // Declaration text
            doc.fontSize(9).fillColor("#000").font("Helvetica-Bold")
                .text("Declaration by Student", 50, yPos);
            yPos += 15;
            doc.fontSize(8).font("Helvetica")
                .text("I hereby declare that, I have read the rules related to admission and the information filled by me in this form is accurate and true to the best of my knowledge. I will be responsible for any discrepancy, arising out of the form signed by me and I undertake that, in absence of any document the final admission will not be granted and/or admission will stand cancel.", 50, yPos, { width: 505, align: "justify" });
            yPos += 35;
            // Ordinances
            if (yPos > 700) {
                doc.addPage();
                yPos = 40;
            }
            doc.fontSize(9).font("Helvetica-Bold")
                .text("ORDINANCES 0.119 RELATING TO THE ATTENDANCE", 50, yPos);
            yPos += 15;
            doc.fontSize(8).font("Helvetica")
                .text("Following shall be the minimum attendance necessary for keeping terms. FIRST TERM/SEMESTER Three-Fourths of days on which lectures are delivered. SECOND TERM/SEMESTER Three-Fourths of days on which lectures are delivered.", 50, yPos, { width: 505, align: "justify" });
            yPos += 30;
            if (yPos > 650) {
                doc.addPage();
                yPos = 40;
            }
            doc.fontSize(9).font("Helvetica-Bold")
                .text("ORDINANCE 0.125 - MUMBAI UNIVERSITY", 50, yPos);
            yPos += 15;
            doc.fontSize(8).font("Helvetica")
                .text("To keep a term an undergraduate must complete to the satisfaction of the principal of course of study at the college prescribed for such term for the class to which such graduate then belongs. Students who fail to satisfy the condition laid down in ordinance will not be permitted to appear at the College and University Examination.", 50, yPos, { width: 505, align: "justify" });
            yPos += 35;
            // Important - Ragging
            if (yPos > 700) {
                doc.addPage();
                yPos = 40;
            }
            doc.fontSize(9).font("Helvetica-Bold")
                .text("IMPORTANT", 50, yPos);
            yPos += 15;
            doc.fontSize(8).font("Helvetica")
                .text("Ragging is strictly prohibited in the college premises and outside. Student indulging in ragging other student will be punished as per the Maharashtra Prohibition of Ragging Act, 1999. Such student will also be expelled from the college and F.I.R. will be lodged with the police against them.", 50, yPos, { width: 505, align: "justify" });
            yPos += 35;
            // Undertaking by Student
            if (yPos > 600) {
                doc.addPage();
                yPos = 40;
            }
            doc.fontSize(9).font("Helvetica-Bold")
                .text("UNDERTAKING BY THE STUDENT", 50, yPos);
            yPos += 15;
            const studentUndertakings = [
                "I have carefully read and fully understood the law prohibiting ragging and the direction of the Supreme Court and the Central/State Government in this regard.",
                "I have read a copy of the UGC regulation Curbing the Menace of Ragging in Higher Education Institutes, 2009 and I have carefully gone through it.",
                "I hereby agree that if found guilty of any aspect of ragging, I may be punished as per the provisions of the UGC/University of Mumbai Regulation mentioned above and/or as per the law in force.",
                "I hereby affirm that I have not been expelled or debarred from admission by any institution.",
                "I hereby undertake that I will register my name in the voters list with the State Election Commission, Government of Maharashtra as soon as I complete the age of 18 Years.",
            ];
            studentUndertakings.forEach((text, index) => {
                if (yPos > 740) {
                    doc.addPage();
                    yPos = 40;
                }
                doc.fontSize(8).font("Helvetica")
                    .text(`${index + 1}. ${text}`, 50, yPos, { width: 505, align: "justify" });
                yPos += 20;
            });
            // Undertaking by Parent/Guardian
            if (yPos > 650) {
                doc.addPage();
                yPos = 40;
            }
            yPos += 10;
            doc.fontSize(9).font("Helvetica-Bold")
                .text("UNDERTAKING BY THE PARENT/GUARDIAN", 50, yPos);
            yPos += 15;
            const parentUndertakings = [
                "I have carefully read and fully understood the law prohibiting ragging and the direction of the Supreme Court and the Central/State Government in this regard as well as UGC Regulation on Curbing the menace of Ragging in Higher Educational Institutes, 2009.",
                "I assure you that my son/daughter/ward will not indulge in any act of ragging.",
                "I hereby agree that if he/she is found guilty of any aspect of ragging, he/she may be punished as per the provision of the UGC Regulation mentioned above and/or as per the law in force.",
            ];
            parentUndertakings.forEach((text, index) => {
                if (yPos > 740) {
                    doc.addPage();
                    yPos = 40;
                }
                doc.fontSize(8).font("Helvetica")
                    .text(`${index + 1}. ${text}`, 50, yPos, { width: 505, align: "justify" });
                yPos += 20;
            });
            // University of Mumbai Declaration
            if (yPos > 500) {
                doc.addPage();
                yPos = 40;
            }
            yPos += 10;
            doc.fontSize(9).font("Helvetica-Bold")
                .text("UNIVERSITY OF MUMBAI DECLARATION / AN UNDERTAKING FROM THE STUDENT", 50, yPos);
            yPos += 15;
            const universityDeclarations = [
                "I hereby declare that I have read all the rules and regulations framed by the college authorities as given in college prospectus, which are presently in force.",
                "I hereby declare and undertake to abide by all the mentioned rules and regulations and hereby agree, if admitted, to confirm to them and to such other rules as may hereafter be made for the smooth functioning of the college.",
                "I may not be granted terms or allowed to appear for the College/University Examination if my attendance in lectures and tutorials/practicals falls short of 75%.",
                "I may not be granted any concession in any matter, if I take up any employment during the course of my studies.",
                "I hereby declare that I shall show satisfactory progress and maintain good conduct.",
                "I hereby declare that I have not registered my name at any other institution for any other full time course.",
                "I hereby declare that the information filled in by me in this Form is accurate and true to the best of my knowledge.",
                "I WILL DISPLAY MY IDENTITY CARD PROMINENTLY IN THE COLLEGE PREMISES.",
                "I have given my and my parents most recent contact details (Phone, Email). In case of any change I undertake to inform college accordingly.",
                "I hereby give my consent for use of my contact details for educational communication.",
                "I am aware that as per University Circular, I am compulsorily required to give an undertaking on www.antiragging.in & www.amanmovement.org",
                "I will get myself enrolled for Voter ID card when I would turn 18 Years of age.",
                "I am aware that if eligible for Scholarship/Freeship scheme then I must complete all the formalities in time.",
                "I confirm that I have paid the full fee amount as per the fee structure for regular students.",
                "I confirm that I have applied for scholarship through MahaDBT portal of Government of Maharashtra.",
                "I hereby declare that if I fail to fill the application form or if my form is rejected, I shall pay the applicable fees to the college within the given timeline.",
                "I have read eligibility conditions of University of Mumbai for my course. My admission will be confirmed subject to confirmation from University of Mumbai.",
            ];
            universityDeclarations.forEach((text, index) => {
                if (yPos > 750) {
                    doc.addPage();
                    yPos = 40;
                }
                doc.fontSize(8).font("Helvetica")
                    .text(`${index + 1}. ${text}`, 50, yPos, { width: 505, align: "justify" });
                yPos += 18;
            });
            // Declaration by Parent/Guardian
            if (yPos > 700) {
                doc.addPage();
                yPos = 40;
            }
            yPos += 15;
            doc.fontSize(9).font("Helvetica-Bold")
                .text("DECLARATION BY PARENT/GUARDIAN", 50, yPos);
            yPos += 15;
            doc.fontSize(8).font("Helvetica")
                .text("I (Mother/Father/Guardian) hereby fully endorse the above undertaking/declaration given by my child/ward. And I will endeavor to induce my child/ward to do his/her best to observe the above stated undertaking in words and spirit.", 50, yPos, { width: 505, align: "justify" });
            yPos += 30;
            // Footer
            doc.fontSize(8).fillColor("#666")
                .text("This is a computer-generated document.", 40, 770, { align: "center", width: 515 })
                .text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 40, 782, { align: "center", width: 515 });
            doc.end();
        }
        catch (error) {
            reject(error);
        }
    });
}
function addSectionHeader(doc, title, yPos) {
    doc.strokeColor("#cccccc").lineWidth(1); // Light gray border
    doc.rect(40, yPos, 515, 25).fillAndStroke("#e8e8e8", "#cccccc");
    doc.strokeColor("#000000"); // Reset to black
    doc.fontSize(11).fillColor("#000").font("Helvetica-Bold")
        .text(title, 50, yPos + 7);
    return yPos + 25;
}
function addTableRow(doc, label1, value1, label2, value2, yPos) {
    const colWidth = 257.5;
    const rowHeight = 25;
    doc.strokeColor("#cccccc").lineWidth(0.5);
    // Helper to check Devanagari
    const hasDevanagari = (text) => /[\u0900-\u097F]/.test(text);
    // Left column
    doc.rect(40, yPos, colWidth, rowHeight).stroke();
    doc.fontSize(8).fillColor("#666").font("Helvetica")
        .text(label1, 45, yPos + 4, { width: colWidth - 10 });
    doc.fontSize(9).fillColor("#000");
    try {
        if (hasDevanagari(value1)) {
            doc.font("Devanagari");
        }
        else {
            doc.font("Helvetica-Bold");
        }
    }
    catch {
        doc.font("Helvetica-Bold");
    }
    doc.text(value1, 45, yPos + 14, { width: colWidth - 10 });
    // Right column
    doc.rect(40 + colWidth, yPos, colWidth, rowHeight).stroke();
    doc.fontSize(8).fillColor("#666").font("Helvetica")
        .text(label2, 45 + colWidth, yPos + 4, { width: colWidth - 10 });
    doc.fontSize(9).fillColor("#000");
    try {
        if (hasDevanagari(value2)) {
            doc.font("Devanagari");
        }
        else {
            doc.font("Helvetica-Bold");
        }
    }
    catch {
        doc.font("Helvetica-Bold");
    }
    doc.text(value2, 45 + colWidth, yPos + 14, { width: colWidth - 10 });
    doc.strokeColor("#000000");
    doc.font("Helvetica");
    return yPos + rowHeight;
}
function addFullWidthRow(doc, label, value, yPos) {
    const rowHeight = 25;
    // Helper to check Devanagari
    const hasDevanagari = (text) => /[\u0900-\u097F]/.test(text);
    doc.strokeColor("#cccccc").lineWidth(0.5);
    doc.rect(40, yPos, 515, rowHeight).stroke();
    doc.strokeColor("#000000");
    doc.fontSize(8).fillColor("#666").font("Helvetica")
        .text(label, 45, yPos + 4, { width: 505 });
    doc.fontSize(9).fillColor("#000");
    try {
        if (hasDevanagari(value)) {
            doc.font("Devanagari");
        }
        else {
            doc.font("Helvetica-Bold");
        }
    }
    catch {
        doc.font("Helvetica-Bold");
    }
    doc.text(value, 45, yPos + 14, { width: 505 });
    doc.font("Helvetica");
    return yPos + rowHeight;
}

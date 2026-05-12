import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

interface StudentAdmissionData {
  applicationNo: string;
  // Personal Details
  surname: string;
  firstName: string;
  fatherName: string;
  motherName: string;
  surnameMr?: string;
  firstNameMr?: string;
  fatherNameMr?: string;
  motherNameMr?: string;
  nameAsPerAadhar: string;
  gender: string;
  aadharNo: string;
  maritalStatus: string;
  bloodGroup: string;
  dob: Date;
  placeBirthCity: string;
  placeBirthTehsil: string;
  placeBirthState: string;
  placeBirthCountry: string;
  nationality: string;
  voterId?: string;
  category: string;
  religion: string;
  caste: string;
  subCaste?: string;
  motherTongue: string;
  differentlyAbled: string;
  stream: string;
  abcId: string;
  prnErnNo?: string;
  employmentStatus?: string;
  
  // Address
  corrAddress: string;
  corrState: string;
  corrDistrict: string;
  corrPincode: string;
  corrCity: string;
  corrResidentialArea?: string;
  permAddress: string;
  permState: string;
  permDistrict: string;
  permPincode: string;
  permCity: string;
  permResidentialArea?: string;
  
  // Contact
  studentMobile: string;
  studentEmail: string;
  parentMobile: string;
  parentEmail: string;
  
  // Parent Details
  parentName: string;
  parentMotherName: string;
  annualIncome?: number;
  occupation: string;
  officeAddress?: string;
  
  // Education
  education?: Array<{
    examination?: string;
    board?: string;
    yearOfPassing?: string;
    instituteName?: string;
    seatNumber?: string;
    obtainedMarks?: number;
    maxMarks?: number;
    percentage?: number;
    grade?: string;
  }>;
  
  qualifyingSubjects?: Array<{
    subjectName?: string;
    obtainedMarks?: number;
    maxMarks?: number;
  }>;
  
  subjectsOffered?: Array<{
    srNo?: number;
    groupName?: string;
    subjectName?: string;
  }>;
}

export async function generateStudentAdmissionPDF(
  data: StudentAdmissionData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: "A4", 
        margin: 40,
        bufferPages: true
      });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // College Header with Border
      doc.rect(40, 40, 515, 100).stroke();
      
      // College Logo/Name (Left-aligned, smaller font)
      doc
        .fontSize(18)
        .fillColor("#8B0000")
        .font("Helvetica-Bold")
        .text("LAXMICHAND GOLWALA COLLEGE", 50, 50, { align: "left", width: 340 })
        .fontSize(12)
        .fillColor("#000")
        .font("Helvetica")
        .text("of Commerce & Economics", 50, 72, { align: "left", width: 340 })
        .fontSize(9)
        .text("M.G. Road, Ghatkopar East, Mumbai - 400077", 50, 90, { align: "left", width: 340 });

      // Photo Placeholder (Right side of header - vertical/portrait)
      doc.rect(420, 45, 125, 90).stroke();
      
      // Display photo if provided, otherwise show placeholder
      if (data.photo) {
        try {
          // If photo is a base64 string or file path, display it
          doc.image(data.photo, 420, 45, { width: 125, height: 90, fit: [125, 90], align: 'center', valign: 'center' });
        } catch (err) {
          doc.fontSize(9).fillColor("#666").text("Paste Photo Here", 425, 85, { width: 115, align: "center" });
        }
      } else {
        doc.fontSize(9).fillColor("#666").text("Paste Photo Here", 425, 85, { width: 115, align: "center" });
      }

      // Application Number Box
      doc.rect(40, 155, 515, 35).fillAndStroke("#f0f0f0", "#000");
      doc
        .fontSize(16)
        .fillColor("#8B0000")
        .font("Helvetica-Bold")
        .text(`APPLICATION NO: ${data.applicationNo}`, 40, 167, { align: "center", width: 515 });

      let yPos = 210;
      
      // Section 1: Personal Details
      yPos = addSectionHeader(doc, "1. PERSONAL DETAILS", yPos);
      yPos = addTableRow(doc, "Surname", data.surname, "First Name", data.firstName, yPos);
      yPos = addTableRow(doc, "Father's Name", data.fatherName, "Mother's Name", data.motherName, yPos);
      
      if (data.surnameMr || data.firstNameMr) {
        yPos = addTableRow(doc, "Surname (Marathi)", data.surnameMr || "-", "First Name (Marathi)", data.firstNameMr || "-", yPos);
      }
      
      yPos = addTableRow(doc, "Name as per Aadhar", data.nameAsPerAadhar, "Gender", data.gender, yPos);
      yPos = addTableRow(doc, "Date of Birth", new Date(data.dob).toLocaleDateString("en-IN"), "Blood Group", data.bloodGroup, yPos);
      yPos = addTableRow(doc, "Aadhar Number", data.aadharNo, "Marital Status", data.maritalStatus, yPos);
      yPos = addTableRow(doc, "Category", data.category, "Religion", data.religion, yPos);
      yPos = addTableRow(doc, "Caste", data.caste, "Mother Tongue", data.motherTongue, yPos);
      yPos = addTableRow(doc, "Nationality", data.nationality, "Differently Abled", data.differentlyAbled, yPos);
      
      yPos += 10;

      // Section 2: Place of Birth
      yPos = addSectionHeader(doc, "2. PLACE OF BIRTH", yPos);
      yPos = addTableRow(doc, "City", data.placeBirthCity, "Tehsil", data.placeBirthTehsil, yPos);
      yPos = addTableRow(doc, "State", data.placeBirthState, "Country", data.placeBirthCountry, yPos);
      
      yPos += 10;

      // Section 3: Academic Details
      yPos = addSectionHeader(doc, "3. ACADEMIC DETAILS", yPos);
      yPos = addTableRow(doc, "Stream", data.stream, "ABC ID", data.abcId, yPos);
      if (data.prnErnNo) {
        yPos = addTableRow(doc, "PRN/ERN No", data.prnErnNo, "Employment Status", data.employmentStatus || "No", yPos);
      }
      
      yPos += 10;

      // Check if we need a new page
      if (yPos > 650) {
        doc.addPage();
        yPos = 40;
      }

      // Section 4: Correspondence Address
      yPos = addSectionHeader(doc, "4. CORRESPONDENCE ADDRESS", yPos);
      yPos = addFullWidthRow(doc, "Address", data.corrAddress, yPos);
      yPos = addTableRow(doc, "City", data.corrCity, "District", data.corrDistrict, yPos);
      yPos = addTableRow(doc, "State", data.corrState, "Pincode", data.corrPincode, yPos);
      
      yPos += 10;

      // Section 5: Permanent Address
      yPos = addSectionHeader(doc, "5. PERMANENT ADDRESS", yPos);
      yPos = addFullWidthRow(doc, "Address", data.permAddress, yPos);
      yPos = addTableRow(doc, "City", data.permCity, "District", data.permDistrict, yPos);
      yPos = addTableRow(doc, "State", data.permState, "Pincode", data.permPincode, yPos);
      
      yPos += 10;

      // Check if we need a new page
      if (yPos > 650) {
        doc.addPage();
        yPos = 40;
      }

      // Section 6: Contact Details
      yPos = addSectionHeader(doc, "6. CONTACT DETAILS", yPos);
      yPos = addTableRow(doc, "Student Mobile", data.studentMobile, "Student Email", data.studentEmail, yPos);
      yPos = addTableRow(doc, "Parent Mobile", data.parentMobile, "Parent Email", data.parentEmail, yPos);
      
      yPos += 10;

      // Section 7: Parent/Guardian Details
      yPos = addSectionHeader(doc, "7. PARENT/GUARDIAN DETAILS", yPos);
      yPos = addTableRow(doc, "Father/Guardian Name", data.parentName, "Mother Name", data.parentMotherName, yPos);
      yPos = addTableRow(doc, "Occupation", data.occupation, "Annual Income", data.annualIncome ? `₹${data.annualIncome.toLocaleString("en-IN")}` : "-", yPos);
      if (data.officeAddress) {
        yPos = addFullWidthRow(doc, "Office Address", data.officeAddress, yPos);
      }
      
      yPos += 10;

      // Education Details
      if (data.education && data.education.length > 0) {
        if (yPos > 600) {
          doc.addPage();
          yPos = 40;
        }
        
        yPos = addSectionHeader(doc, "8. EDUCATION DETAILS", yPos);
        
        data.education.forEach((edu, index) => {
          if (edu.examination) {
            if (yPos > 700) {
              doc.addPage();
              yPos = 40;
            }
            
            doc.fontSize(10).fillColor("#000").font("Helvetica-Bold")
              .text(`${index + 1}. ${edu.examination}`, 50, yPos);
            yPos += 15;
            
            if (edu.board) yPos = addTableRow(doc, "Board", edu.board, "Year", edu.yearOfPassing || "-", yPos);
            if (edu.instituteName) yPos = addFullWidthRow(doc, "Institute", edu.instituteName, yPos);
            if (edu.obtainedMarks) yPos = addTableRow(doc, "Marks", `${edu.obtainedMarks}/${edu.maxMarks}`, "Percentage", edu.percentage ? `${edu.percentage}%` : "-", yPos);
            
            yPos += 5;
          }
        });
      }

      // Signature Box at bottom
      if (yPos > 650) {
        doc.addPage();
        yPos = 40;
      }
      
      yPos += 30;
      doc.rect(380, yPos, 170, 60).stroke();
      
      // Display signature if provided, otherwise show placeholder
      if (data.signature) {
        try {
          doc.image(data.signature, 385, yPos + 5, { width: 160, height: 40, fit: [160, 40], align: 'center', valign: 'top' });
          doc.fontSize(9).fillColor("#666").text("Student Signature", 400, yPos + 48, { width: 130, align: "center" });
        } catch (err) {
          doc.fontSize(9).fillColor("#666").text("Student Signature", 400, yPos + 25, { width: 130, align: "center" });
        }
      } else {
        doc.fontSize(9).fillColor("#666").text("Student Signature", 400, yPos + 25, { width: 130, align: "center" });
      }

      // Footer
      doc.fontSize(8).fillColor("#666")
        .text("This is a computer-generated document.", 40, 770, { align: "center", width: 515 })
        .text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 40, 782, { align: "center", width: 515 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function addSectionHeader(doc: PDFKit.PDFDocument, title: string, yPos: number): number {
  doc.rect(40, yPos, 515, 25).fillAndStroke("#e8e8e8", "#000");
  doc.fontSize(11).fillColor("#000").font("Helvetica-Bold")
    .text(title, 50, yPos + 7);
  return yPos + 25;
}

function addTableRow(doc: PDFKit.PDFDocument, label1: string, value1: string, label2: string, value2: string, yPos: number): number {
  const colWidth = 257.5;
  
  // Left column
  doc.rect(40, yPos, colWidth, 20).stroke();
  doc.fontSize(8).fillColor("#666").font("Helvetica")
    .text(label1, 45, yPos + 3, { width: colWidth - 10 });
  doc.fontSize(9).fillColor("#000").font("Helvetica-Bold")
    .text(value1, 45, yPos + 11, { width: colWidth - 10 });
  
  // Right column
  doc.rect(40 + colWidth, yPos, colWidth, 20).stroke();
  doc.fontSize(8).fillColor("#666").font("Helvetica")
    .text(label2, 45 + colWidth, yPos + 3, { width: colWidth - 10 });
  doc.fontSize(9).fillColor("#000").font("Helvetica-Bold")
    .text(value2, 45 + colWidth, yPos + 11, { width: colWidth - 10 });
  
  return yPos + 20;
}

function addFullWidthRow(doc: PDFKit.PDFDocument, label: string, value: string, yPos: number): number {
  doc.rect(40, yPos, 515, 20).stroke();
  doc.fontSize(8).fillColor("#666").font("Helvetica")
    .text(label, 45, yPos + 3, { width: 505 });
  doc.fontSize(9).fillColor("#000").font("Helvetica-Bold")
    .text(value, 45, yPos + 11, { width: 505 });
  
  return yPos + 20;
}

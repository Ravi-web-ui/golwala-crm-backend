"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStudentAdmissionPDF = generateStudentAdmissionPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
async function generateStudentAdmissionPDF(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({ size: "A4", margin: 40 });
            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);
            // Header
            doc
                .fontSize(20)
                .fillColor("#c0392b")
                .text("LAXMICHAND GOLWALA COLLEGE", { align: "center" })
                .fontSize(12)
                .fillColor("#000")
                .text("of Commerce & Economics", { align: "center" })
                .moveDown(0.5)
                .fontSize(10)
                .text("M.G. Road, Ghatkopar East, Mumbai 400077", { align: "center" })
                .moveDown(1);
            // Application Number Box
            doc
                .fontSize(14)
                .fillColor("#c0392b")
                .text(`Application No: ${data.applicationNo}`, { align: "center" })
                .moveDown(1);
            // Section: Personal Details
            addSection(doc, "PERSONAL DETAILS");
            addField(doc, "Surname", data.surname);
            addField(doc, "First Name", data.firstName);
            addField(doc, "Father's Name", data.fatherName);
            addField(doc, "Mother's Name", data.motherName);
            if (data.surnameMr)
                addField(doc, "Surname (Marathi)", data.surnameMr);
            if (data.firstNameMr)
                addField(doc, "First Name (Marathi)", data.firstNameMr);
            addField(doc, "Name as per Aadhar", data.nameAsPerAadhar);
            addField(doc, "Gender", data.gender);
            addField(doc, "Aadhar Number", data.aadharNo);
            addField(doc, "Marital Status", data.maritalStatus);
            addField(doc, "Blood Group", data.bloodGroup);
            addField(doc, "Date of Birth", new Date(data.dob).toLocaleDateString("en-IN"));
            addField(doc, "Place of Birth", `${data.placeBirthCity}, ${data.placeBirthTehsil}, ${data.placeBirthState}, ${data.placeBirthCountry}`);
            addField(doc, "Nationality", data.nationality);
            if (data.voterId)
                addField(doc, "Voter ID", data.voterId);
            addField(doc, "Category", data.category);
            addField(doc, "Religion", data.religion);
            addField(doc, "Caste", data.caste);
            if (data.subCaste)
                addField(doc, "Sub-Caste", data.subCaste);
            addField(doc, "Mother Tongue", data.motherTongue);
            addField(doc, "Differently Abled", data.differentlyAbled);
            addField(doc, "Stream", data.stream);
            addField(doc, "ABC ID", data.abcId);
            if (data.prnErnNo)
                addField(doc, "PRN/ERN No", data.prnErnNo);
            if (data.employmentStatus)
                addField(doc, "Employment Status", data.employmentStatus);
            doc.moveDown(1);
            // Section: Correspondence Address
            addSection(doc, "CORRESPONDENCE ADDRESS");
            addField(doc, "Address", data.corrAddress);
            addField(doc, "City", data.corrCity);
            addField(doc, "District", data.corrDistrict);
            addField(doc, "State", data.corrState);
            addField(doc, "Pincode", data.corrPincode);
            if (data.corrResidentialArea)
                addField(doc, "Residential Area", data.corrResidentialArea);
            doc.moveDown(1);
            // Section: Permanent Address
            addSection(doc, "PERMANENT ADDRESS");
            addField(doc, "Address", data.permAddress);
            addField(doc, "City", data.permCity);
            addField(doc, "District", data.permDistrict);
            addField(doc, "State", data.permState);
            addField(doc, "Pincode", data.permPincode);
            if (data.permResidentialArea)
                addField(doc, "Residential Area", data.permResidentialArea);
            doc.moveDown(1);
            // Section: Contact Details
            addSection(doc, "CONTACT DETAILS");
            addField(doc, "Student Mobile", data.studentMobile);
            addField(doc, "Student Email", data.studentEmail);
            addField(doc, "Parent Mobile", data.parentMobile);
            addField(doc, "Parent Email", data.parentEmail);
            doc.moveDown(1);
            // Section: Parent Details
            addSection(doc, "PARENT/GUARDIAN DETAILS");
            addField(doc, "Parent Name", data.parentName);
            addField(doc, "Parent Mother Name", data.parentMotherName);
            if (data.annualIncome)
                addField(doc, "Annual Income", `₹${data.annualIncome.toLocaleString("en-IN")}`);
            addField(doc, "Occupation", data.occupation);
            if (data.officeAddress)
                addField(doc, "Office Address", data.officeAddress);
            // Add new page for education details if needed
            if (data.education && data.education.length > 0) {
                doc.addPage();
                addSection(doc, "EDUCATION DETAILS");
                data.education.forEach((edu, index) => {
                    if (edu.examination) {
                        doc.fontSize(10).fillColor("#000").text(`${index + 1}. ${edu.examination}`, { underline: true });
                        if (edu.board)
                            addField(doc, "  Board", edu.board, false);
                        if (edu.yearOfPassing)
                            addField(doc, "  Year of Passing", edu.yearOfPassing, false);
                        if (edu.instituteName)
                            addField(doc, "  Institute", edu.instituteName, false);
                        if (edu.seatNumber)
                            addField(doc, "  Seat Number", edu.seatNumber, false);
                        if (edu.obtainedMarks)
                            addField(doc, "  Marks", `${edu.obtainedMarks}/${edu.maxMarks}`, false);
                        if (edu.percentage)
                            addField(doc, "  Percentage", `${edu.percentage}%`, false);
                        if (edu.grade)
                            addField(doc, "  Grade", edu.grade, false);
                        doc.moveDown(0.5);
                    }
                });
            }
            // Qualifying Subjects
            if (data.qualifyingSubjects && data.qualifyingSubjects.length > 0) {
                doc.moveDown(1);
                addSection(doc, "LAST QUALIFYING SUBJECT DETAILS");
                data.qualifyingSubjects.forEach((sub, index) => {
                    if (sub.subjectName) {
                        addField(doc, `Subject ${index + 1}`, `${sub.subjectName} - ${sub.obtainedMarks}/${sub.maxMarks}`, false);
                    }
                });
            }
            // Subjects Offered
            if (data.subjectsOffered && data.subjectsOffered.length > 0) {
                doc.moveDown(1);
                addSection(doc, "SUBJECTS OFFERED");
                data.subjectsOffered.forEach((sub) => {
                    if (sub.subjectName) {
                        addField(doc, sub.groupName || "Subject", sub.subjectName, false);
                    }
                });
            }
            // Footer
            doc.moveDown(2);
            doc
                .fontSize(10)
                .fillColor("#666")
                .text("This is a computer-generated document.", { align: "center" })
                .text(`Generated on: ${new Date().toLocaleString("en-IN")}`, { align: "center" });
            doc.end();
        }
        catch (error) {
            reject(error);
        }
    });
}
function addSection(doc, title) {
    doc
        .fontSize(12)
        .fillColor("#c0392b")
        .text(title, { underline: true })
        .fillColor("#000")
        .moveDown(0.5);
}
function addField(doc, label, value, moveDown = true) {
    doc
        .fontSize(10)
        .fillColor("#666")
        .text(label + ": ", { continued: true })
        .fillColor("#000")
        .text(value);
    if (moveDown)
        doc.moveDown(0.3);
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, ExtractedPrescription } from '../types';

export const generateProfessionalPDF = (patient: Patient, extracted: ExtractedPrescription) => {
  const doc = new jsPDF() as any;
  const primaryColor: [number, number, number] = [30, 58, 138]; // slate-900 equivalent (approximated)
  const accentColor: [number, number, number] = [37, 99, 235]; // blue-600
  
  // PAGE SETUP
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;

  // HEADER BACKGROUND (SUBTLE)
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // HOSPITAL LOGO / NAME
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('KALYANI HOSPITAL', margin, 20);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('MULTI-SPECIALTY CARE CENTER', margin, 26);
  doc.text('Civil Lines, New Delhi - 110054', margin, 31);
  doc.text('Contact: +91 98765 43210 | info@kalyanihospital.com', margin, 36);

  // DATE & RX EMBLEM
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(40);
  doc.setTextColor(230);
  doc.text('Rx', margin, 65);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageWidth - margin - 40, 60);

  // PATIENT BLOCK
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, 70, pageWidth - (margin * 2), 25, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text('PATIENT DETAILS', margin + 5, 76);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(patient.name.toUpperCase(), margin + 5, 83);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${patient.gender}, ${patient.age} Years`, margin + 5, 89);
  doc.text(`UID: ${patient.phone}`, pageWidth - margin - 45, 89);

  // CLINICAL OBSERVATIONS
  let currentY = 110;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('CHIEF COMPLAINTS & SYMPTOMS', margin, currentY);
  doc.line(margin, currentY + 2, margin + 60, currentY + 2);
  
  currentY += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(50);
  const symptoms = doc.splitTextToSize(extracted.symptoms || 'No symptoms reported.', pageWidth - (margin * 2));
  doc.text(symptoms, margin, currentY);
  
  currentY += (symptoms.length * 6) + 10;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('DIAGNOSIS', margin, currentY);
  doc.line(margin, currentY + 2, margin + 25, currentY + 2);

  currentY += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const diagnosis = doc.splitTextToSize(extracted.diagnosis || 'Diagnosis pending further investigation.', pageWidth - (margin * 2));
  doc.text(diagnosis, margin, currentY);

  currentY += (diagnosis.length * 6) + 15;

  // MEDICATIONS TABLE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PRESCRIPTION / MEDICATIONS', margin, currentY);
  
  const tableData = extracted.medicines.map((m, index) => [
    index + 1,
    m.name,
    m.dosage,
    m.frequency,
    m.duration
  ]);

  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    head: [['#', 'Medicine Name', 'Dosage', 'Frequency', 'Duration']],
    body: tableData,
    theme: 'striped',
    headStyles: { 
      fillColor: primaryColor, 
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 4
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 'auto', fontStyle: 'bold' }
    }
  });

  // FOOTER
  const finalY = (doc as any).lastAutoTable.finalY + 30;
  
  // SIGNATURE AREA
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('__________________________', pageWidth - margin - 50, finalY);
  doc.text('Authorized Signature', pageWidth - margin - 45, finalY + 7);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('Digital Signature of Dr. S. Sharma', pageWidth - margin - 48, finalY + 12);

  // DISCLAIMER
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150);
  const disclaimer = 'This prescription is valid until the specified duration. In case of any adverse reaction, please stop the medication and consult the doctor immediately.';
  doc.text(disclaimer, pageWidth / 2, pageHeight - 15, { align: 'center' });
  
  doc.setFontSize(7);
  doc.text(`Generated on: ${new Date().toLocaleString()} | Kalyani Hospital Digital Records`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  doc.save(`Prescription_${patient.name}_${new Date().toISOString().split('T')[0]}.pdf`);
};

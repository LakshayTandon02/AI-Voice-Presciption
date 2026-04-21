import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, ExtractedPrescription } from '../types';

export const generateProfessionalPDF = (patient: Patient, extracted: ExtractedPrescription) => {
  const doc = new jsPDF() as any;
  
  // Design System - Premium Navy & Slate
  const colors = {
    primary: [30, 41, 59],   // Deep Slate/Navy
    accent: [51, 65, 85],    // Slate 700
    text: [15, 23, 42],      // Slate 900
    subtext: [100, 116, 139], // Slate 500
    border: [203, 213, 225],  // Slate 300
    lightBg: [241, 245, 249], // Slate 100
  };
  
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // 1. TOP HEADER - REFINED & BOLD
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Logo
  try {
    doc.addImage('/kalyani-logo.png', 'PNG', margin, 10, 18, 18);
  } catch (e) {
    doc.setFillColor(255, 255, 255, 0.2);
    doc.roundedRect(margin, 10, 18, 18, 2, 2, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('KH', margin + 9, 21, { align: 'center' });
  }

  // Hospital Name & Tagline
  doc.setTextColor(255);
  doc.setFont('times', 'bold');
  doc.setFontSize(28);
  doc.text('KALYANI HOSPITAL', margin + 22, 22);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200);
  doc.text('Advanced Multi-Speciality Healthcare Centre • Trusted Quality Care', margin + 22, 27);

  // Contact Info in Header
  doc.setFontSize(7.5);
  doc.setTextColor(220);
  const contactText = 'Raikot Road, Jagraon • Tel: 01624-222179 • kalyanihospitaljgn@gmail.com';
  doc.text(contactText, pageWidth - margin, 34, { align: 'right' });

  // 2. PATIENT DATA BLOCK - STRUCTURED
  const patientY = 48;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(colors.subtext[0], colors.subtext[1], colors.subtext[2]);
  
  doc.text('PATIENT NAME', margin, patientY);
  doc.text('AGE / GENDER', margin + 70, patientY);
  doc.text('DATE', pageWidth - margin - 30, patientY);

  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.setFontSize(10);
  doc.text(patient.name.toUpperCase(), margin, patientY + 6);
  doc.text(`${patient.age} Y  /  ${patient.gender.toUpperCase()}`, margin + 70, patientY + 6);
  doc.text(new Date().toLocaleDateString('en-IN'), pageWidth - margin - 30, patientY + 6);

  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, patientY + 10, pageWidth - margin, patientY + 10);

  // 3. VITALS - MINIMALIST
  const vitalsY = 65;
  const vitals = [
    { k: 'B.P.', v: '___ / ___' },
    { k: 'Pulse', v: '___ bpm' },
    { k: 'Weight', v: '___ kg' },
    { k: 'Temp', v: '___ °F' },
    { k: 'SpO2', v: '___ %' }
  ];
  
  vitals.forEach((v, i) => {
    const x = margin + (i * (contentWidth / 5));
    doc.setFontSize(7);
    doc.setTextColor(colors.subtext[0], colors.subtext[1], colors.subtext[2]);
    doc.text(v.k, x, vitalsY);
    doc.setFontSize(9);
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.text(v.v, x, vitalsY + 5);
  });

  // 4. CLINICAL CONTENT area
  // doc.setFont('times', 'bolditalic');
  // doc.setFontSize(36);
  // doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  // doc.text('Rx', margin, 85);

  let currentY = 92;

  // CHIEF COMPLAINT section
  if (extracted.symptoms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text('CHIEF COMPLAINT:', margin, currentY);
    
    doc.setFont('helvetica', 'normal');
    const complaintText = doc.splitTextToSize(extracted.symptoms, contentWidth - 5);
    doc.text(complaintText, margin, currentY + 5);
    currentY += (complaintText.length * 5) + 8;
  }

  // CLINICAL DIAGNOSIS section
  if (extracted.diagnosis) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text('CLINICAL DIAGNOSIS:', margin, currentY);
    
    doc.setFont('helvetica', 'normal');
    const diagnosisText = doc.splitTextToSize(extracted.diagnosis, contentWidth - 5);
    doc.text(diagnosisText, margin, currentY + 5);
    currentY += (diagnosisText.length * 5) + 12;
  }

  // ADVISORY / MEDICINES
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.text('ADVISED MEDICATION', margin, currentY);
  currentY += 4;

  const tableData = extracted.medicines.map((m, i) => [
    (i + 1).toString(),
    m.name,
    m.dosage,
    m.frequency,
    m.duration
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Medicine Name', 'Dosage', 'Frequency', 'Duration']],
    body: tableData,
    theme: 'plain',
    headStyles: { 
      fillColor: [240, 240, 240], 
      textColor: colors.primary as any, 
      fontSize: 8.5,
      fontStyle: 'bold',
      cellPadding: 3
    },
    bodyStyles: { 
      fontSize: 9, 
      textColor: colors.text as any,
      cellPadding: 4,
      lineColor: [245, 245, 245],
      lineWidth: 0.1
    },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
    }
  });

  // 5. REFINED FOOTER
  const footerY = pageHeight - 65;
  doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setLineWidth(1);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text('PANEL OF SPECIALIST CONSULTANTS', margin, footerY + 8);

  const doctors = [
    ['Dr. Deepak Kumar', 'M.S. (Ortho)'],
    ['Dr. Meena Lal', 'M.S. (Gynae)'],
    ['Dr. Gagan Arora', 'Phaco Surgeon'],
    ['Dr. Rose Kamal', 'MD Physician'],
    ['Dr. Daljeet Singh', 'M.S. Surgeon'],
    ['Dr. Sanchit Garg', 'Plastic Surgery'],
    ['Dr. Abhishek Gupta', 'Psychiatrist'],
    ['Dr. Vishnu Gupta', 'Neuro Surgery']
  ];

  const colWidth = contentWidth / 4;
  doctors.forEach((d, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const x = margin + (col * colWidth);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.text(d[0], x, footerY + 16 + (row * 8));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(colors.subtext[0], colors.subtext[1], colors.subtext[2]);
    doc.text(d[1], x, footerY + 19 + (row * 8));
  });

  // Emergency Bar
  const bottomY = pageHeight - 12;
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, bottomY - 6, pageWidth, 18, 'F');
  
  doc.setTextColor(255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('24 HOURS EMERGENCY: 01624-222179  |  COMMITMENT TO CARE', pageWidth / 2, bottomY + 2, { align: 'center' });

  // Final Action
  doc.autoPrint();
  doc.save(`Kalyani_Rx_${patient.name}_${new Date().getTime()}.pdf`);
};



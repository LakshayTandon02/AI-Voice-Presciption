export interface Patient {
  id?: string;
  name: string;
  phone: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  createdAt: string;
  initialSymptoms?: string;
  initialDiagnosis?: string;
}

export interface Visit {
  id?: string;
  patientPhone: string;
  date: string;
  symptoms: string;
  diagnosis: string;
  notes?: string;
}

export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface Prescription {
  id?: string;
  visitId: string;
  patientPhone: string;
  date: string;
  medicines: Medicine[];
}

export interface ExtractedPrescription {
  symptoms: string;
  diagnosis: string;
  medicines: Medicine[];
}

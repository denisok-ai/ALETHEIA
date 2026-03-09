/**
 * Certificate PDF generation with @react-pdf/renderer.
 * Used by API to generate and optionally upload to Storage.
 */
import React from 'react';
import { Document, Page, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 60,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
  },
  name: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
  },
  course: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  number: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 40,
    color: '#666',
  },
  date: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    color: '#666',
  },
});

export interface CertificateData {
  userName: string;
  courseName: string;
  certNumber: string;
  date: string;
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>AVATERRA</Text>
        <Text style={styles.subtitle}>Phygital школа мышечного тестирования</Text>
        <Text style={styles.name}>{data.userName}</Text>
        <Text style={styles.course}>успешно прошёл(ла) курс</Text>
        <Text style={styles.course}>{data.courseName}</Text>
        <Text style={styles.number}>Сертификат № {data.certNumber}</Text>
        <Text style={styles.date}>{data.date}</Text>
      </Page>
    </Document>
  );
  const result = await renderToBuffer(doc);
  return Buffer.isBuffer(result) ? result : Buffer.from(result as ArrayBuffer);
}

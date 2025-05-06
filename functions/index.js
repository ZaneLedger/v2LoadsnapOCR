/**
 * Gen 2 Cloud Functions using the v2 SDK
 */

const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { ImageAnnotatorClient } = require("@google-cloud/vision");
const logger = require("firebase-functions/logger");
const path = require("path");

// Initialize Firebase Admin SDK
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const visionClient = new ImageAnnotatorClient();
const bucket = admin.storage().bucket();

/**
 * processTicketOCR: triggered on new images in Storage
 */
exports.processTicketOCR = onObjectFinalized(
  { region: "us-central1" },
  async (event) => {
    const { name: filePath, contentType, resourceState } = event.data;
    logger.info(`Storage event for ${filePath}`, { contentType, resourceState });

    // Only handle new image finalization events
    if (resourceState === 'not_exists' || !contentType?.startsWith('image/')) return;

    // Extract uploader UID and filename
    const parts = filePath.split('/');
    const uploaderUid = parts[1] || 'unknown_uid';
    const fileName = path.basename(filePath);

    // Create initial Firestore record
    const docRef = db.collection('tickets').doc();
    await docRef.set({
      storagePath: filePath,
      uploaderUid,
      fileName,
      contentType,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'processing_ocr',
      fixNeeded: false,
      manual: false
    });

    try {
      // Download and perform OCR
      const file = bucket.file(filePath);
      const [buffer] = await file.download();
      const [ocrResult] = await visionClient.textDetection({ image: { content: buffer } });
      const fullText =
        ocrResult.fullTextAnnotation?.text ||
        ocrResult.textAnnotations?.[0]?.description ||
        '';
      logger.info('FULL_OCR_TEXT', fullText);

      // Split into lines for fallback
      const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      // Parsing logic with regex + fallback
      let ticketNumber = null;
      const tMatch = fullText.match(/Ticket\s*#?:?\s*(\d{3,})/i);
      if (tMatch) ticketNumber = tMatch[1];
      else {
        const line = lines.find(l => /^\d{3,}$/.test(l));
        if (line) ticketNumber = line;
      }

      let weightTons = null;
      const wMatch = fullText.match(/Weight\s*[:\-]?\s*([\d.,]+)/i);
      if (wMatch) weightTons = wMatch[1].replace(/,/g, '');

      let truckNumber = null;
      const trMatch = fullText.match(/Truck\s*(?:No|#)?\s*[:\-]?\s*([A-Za-z0-9\-]+)/i);
      if (trMatch) truckNumber = trMatch[1];

      const driverActual = (fullText.match(/Driver\s*[:\-]?\s*([A-Za-z .'-]{3,})/i) || [])[1] || null;
      const driverBadge = (fullText.match(/Monitor Name\(Id\):\s*([A-Za-z0-9]+)/i) || [])[1] || null;
      const debrisType = (fullText.match(/Debris\s*Type\s*[:\-]?\s*([A-Za-z ]+)/i) || [])[1] || null;

      const parsed = { ticketNumber, weightTons, truckNumber, driverActual, driverBadge, debrisType };
      const needsFix = !ticketNumber || !weightTons;

      // Update Firestore with OCR results
      await docRef.update({
        ...parsed,
        status: needsFix ? 'draft' : 'pending',
        fixNeeded: needsFix,
        ocrProcessedTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`Processed ticket ${docRef.id}`, parsed);
    } catch (err) {
      logger.error(`OCR process error for ${filePath}:`, err);
      await docRef.update({
        status: 'ocr_error',
        fixNeeded: true,
        ocrError: err.message,
        ocrProcessedTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
);

/**
 * Callable: saveTicketFix
 */
exports.saveTicketFix = onCall({ region: 'us-central1' }, async (req) => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign-in required');
  const { ticketId, updates } = req.data || {};
  if (!ticketId || typeof ticketId !== 'string') throw new HttpsError('invalid-argument', 'Invalid ticketId');
  if (typeof updates !== 'object') throw new HttpsError('invalid-argument', 'Invalid updates');
  await db.collection('tickets').doc(ticketId).update({
    ...updates,
    status: 'pending',
    reviewedByUid: req.auth.uid,
    reviewTimestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  return { success: true, message: `Ticket ${ticketId} updated.` };
});

/**
 * Callable: rejectTicket
 */
exports.rejectTicket = onCall({ region: 'us-central1' }, async (req) => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign-in required');
  const id = req.data.ticketId;
  if (!id || typeof id !== 'string') throw new HttpsError('invalid-argument', 'Invalid ticketId');
  await db.collection('tickets').doc(id).update({
    status: 'rejected',
    reviewedByUid: req.auth.uid,
    reviewTimestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  return { success: true, message: `Ticket ${id} rejected.` };
});

/**
 * Callable: approveTicket
 */
exports.approveTicket = onCall({ region: 'us-central1' }, async (req) => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign-in required');
  const id = req.data.ticketId;
  if (!id || typeof id !== 'string') throw new HttpsError('invalid-argument', 'Invalid ticketId');
  await db.collection('tickets').doc(id).update({
    status: 'approved',
    fixNeeded: false,
    reviewedByUid: req.auth.uid,
    reviewTimestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  return { success: true, message: `Ticket ${id} approved.` };
});

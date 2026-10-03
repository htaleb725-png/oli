import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  limit,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Citizen,
  OfficeRequest,
  Interview,
  User,
  AuditLog,
  ChequeRecord,
  OfficialLetter,
  OrganizationRecord,
  SystemSettings,
  DropdownItem
} from '../types';

/**
 * Deep sanitization function to remove any `undefined` values.
 * Firestore strictly forbids `undefined` values and throws an error if encountered.
 */
export const cleanData = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanData);
  }
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        res[k] = cleanData(v);
      }
    }
    return res;
  }
  return obj;
};

/* ----------------------------------------------------
 * CITIZENS SYNC
 * -------------------------------------------------- */
export const syncCitizenToFirestore = async (citizen: Citizen): Promise<boolean> => {
  if (!citizen?.Citizen_ID) return false;
  try {
    const docRef = doc(db, 'citizens', citizen.Citizen_ID);
    const cleaned = cleanData({ ...citizen });
    await setDoc(docRef, cleaned, { merge: true });
    console.log(`[Firestore] Citizen saved: ${citizen.Citizen_ID} (${citizen.FullName})`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed saving citizen ${citizen.Citizen_ID}:`, error);
    return false;
  }
};

export const deleteCitizenFromFirestore = async (citizenId: string): Promise<boolean> => {
  if (!citizenId) return false;
  try {
    const docRef = doc(db, 'citizens', citizenId);
    await deleteDoc(docRef);
    console.log(`[Firestore] Citizen deleted: ${citizenId}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed deleting citizen ${citizenId}:`, error);
    return false;
  }
};

/* ----------------------------------------------------
 * REQUESTS SYNC
 * -------------------------------------------------- */
export const syncRequestToFirestore = async (req: OfficeRequest): Promise<boolean> => {
  if (!req?.Request_ID) return false;
  try {
    const docRef = doc(db, 'requests', req.Request_ID);
    const cleaned = cleanData({ ...req });
    await setDoc(docRef, cleaned, { merge: true });
    console.log(`[Firestore] Request saved: ${req.Request_ID}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed saving request ${req.Request_ID}:`, error);
    return false;
  }
};

export const deleteRequestFromFirestore = async (requestId: string): Promise<boolean> => {
  if (!requestId) return false;
  try {
    const docRef = doc(db, 'requests', requestId);
    await deleteDoc(docRef);
    console.log(`[Firestore] Request deleted: ${requestId}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed deleting request ${requestId}:`, error);
    return false;
  }
};

/* ----------------------------------------------------
 * INTERVIEWS SYNC
 * -------------------------------------------------- */
export const syncInterviewToFirestore = async (interview: Interview): Promise<boolean> => {
  if (!interview?.Interview_ID) return false;
  try {
    const docRef = doc(db, 'interviews', interview.Interview_ID);
    const cleaned = cleanData({ ...interview });
    await setDoc(docRef, cleaned, { merge: true });
    console.log(`[Firestore] Interview saved: ${interview.Interview_ID}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed saving interview ${interview.Interview_ID}:`, error);
    return false;
  }
};

export const deleteInterviewFromFirestore = async (interviewId: string): Promise<boolean> => {
  if (!interviewId) return false;
  try {
    const docRef = doc(db, 'interviews', interviewId);
    await deleteDoc(docRef);
    console.log(`[Firestore] Interview deleted: ${interviewId}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed deleting interview ${interviewId}:`, error);
    return false;
  }
};

/* ----------------------------------------------------
 * CHEQUES SYNC
 * -------------------------------------------------- */
export const syncChequeToFirestore = async (cheque: ChequeRecord): Promise<boolean> => {
  if (!cheque?.id) return false;
  try {
    const docRef = doc(db, 'cheques', cheque.id);
    const cleaned = cleanData({ ...cheque });
    await setDoc(docRef, cleaned, { merge: true });
    console.log(`[Firestore] Cheque saved: ${cheque.id}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed saving cheque ${cheque.id}:`, error);
    return false;
  }
};

export const deleteChequeFromFirestore = async (chequeId: string): Promise<boolean> => {
  if (!chequeId) return false;
  try {
    const docRef = doc(db, 'cheques', chequeId);
    await deleteDoc(docRef);
    console.log(`[Firestore] Cheque deleted: ${chequeId}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed deleting cheque ${chequeId}:`, error);
    return false;
  }
};

/* ----------------------------------------------------
 * OFFICIAL LETTERS SYNC
 * -------------------------------------------------- */
export const syncLetterToFirestore = async (letter: OfficialLetter): Promise<boolean> => {
  if (!letter?.Letter_ID) return false;
  try {
    const docRef = doc(db, 'letters', letter.Letter_ID);
    const cleaned = cleanData({ ...letter });
    await setDoc(docRef, cleaned, { merge: true });
    console.log(`[Firestore] Letter saved: ${letter.Letter_ID}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed saving letter ${letter.Letter_ID}:`, error);
    return false;
  }
};

export const deleteLetterFromFirestore = async (letterId: string): Promise<boolean> => {
  if (!letterId) return false;
  try {
    const docRef = doc(db, 'letters', letterId);
    await deleteDoc(docRef);
    console.log(`[Firestore] Letter deleted: ${letterId}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed deleting letter ${letterId}:`, error);
    return false;
  }
};

/* ----------------------------------------------------
 * ORGANIZATIONS SYNC
 * -------------------------------------------------- */
export const syncOrgRecordToFirestore = async (org: OrganizationRecord): Promise<boolean> => {
  if (!org?.Org_ID) return false;
  try {
    const docRef = doc(db, 'organizations', org.Org_ID);
    const cleaned = cleanData({ ...org });
    await setDoc(docRef, cleaned, { merge: true });
    console.log(`[Firestore] Organization saved: ${org.Org_ID}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed saving organization ${org.Org_ID}:`, error);
    return false;
  }
};

export const deleteOrgRecordFromFirestore = async (orgId: string): Promise<boolean> => {
  if (!orgId) return false;
  try {
    const docRef = doc(db, 'organizations', orgId);
    await deleteDoc(docRef);
    console.log(`[Firestore] Organization deleted: ${orgId}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed deleting organization ${orgId}:`, error);
    return false;
  }
};

/* ----------------------------------------------------
 * USERS SYNC
 * -------------------------------------------------- */
export const syncUserToFirestore = async (user: User): Promise<boolean> => {
  if (!user?.User_ID) return false;
  try {
    const docRef = doc(db, 'users', user.User_ID);
    const cleaned = cleanData({ ...user });
    await setDoc(docRef, cleaned, { merge: true });
    console.log(`[Firestore] User saved: ${user.User_ID}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed saving user ${user.User_ID}:`, error);
    return false;
  }
};

export const deleteUserFromFirestore = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  try {
    const docRef = doc(db, 'users', userId);
    await deleteDoc(docRef);
    console.log(`[Firestore] User deleted: ${userId}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed deleting user ${userId}:`, error);
    return false;
  }
};

/* ----------------------------------------------------
 * SETTINGS SYNC
 * -------------------------------------------------- */
export const syncSettingsToFirestore = async (settings: SystemSettings): Promise<boolean> => {
  try {
    const docRef = doc(db, 'settings', 'global_settings');
    const cleaned = cleanData({ id: 'global_settings', ...settings, updatedAt: new Date().toISOString() });
    await setDoc(docRef, cleaned, { merge: true });
    console.log('[Firestore] Settings saved successfully');
    return true;
  } catch (error) {
    console.error('[Firestore Error] Failed saving settings:', error);
    return false;
  }
};

/* ----------------------------------------------------
 * DROPDOWNS SYNC
 * -------------------------------------------------- */
export const syncDropdownItemToFirestore = async (item: DropdownItem): Promise<boolean> => {
  if (!item?.id) return false;
  try {
    const docRef = doc(db, 'dropdowns', item.id);
    const cleaned = cleanData({ ...item });
    await setDoc(docRef, cleaned, { merge: true });
    console.log(`[Firestore] Dropdown saved: ${item.id}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed saving dropdown ${item.id}:`, error);
    return false;
  }
};

export const deleteDropdownItemFromFirestore = async (itemId: string): Promise<boolean> => {
  if (!itemId) return false;
  try {
    const docRef = doc(db, 'dropdowns', itemId);
    await deleteDoc(docRef);
    console.log(`[Firestore] Dropdown deleted: ${itemId}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed deleting dropdown ${itemId}:`, error);
    return false;
  }
};

/* ----------------------------------------------------
 * AUDIT LOGS SYNC
 * -------------------------------------------------- */
export const syncAuditLogToFirestore = async (log: AuditLog): Promise<boolean> => {
  if (!log?.Log_ID) return false;
  try {
    const docRef = doc(db, 'audit_logs', log.Log_ID);
    const cleaned = cleanData({ ...log });
    await setDoc(docRef, cleaned);
    console.log(`[Firestore] Audit log saved: ${log.Log_ID}`);
    return true;
  } catch (error) {
    console.error(`[Firestore Error] Failed saving audit log ${log.Log_ID}:`, error);
    return false;
  }
};

/* ----------------------------------------------------
 * REALTIME SUBSCRIPTIONS (LIVE LISTENERS)
 * -------------------------------------------------- */
export const subscribeToFirestoreCollection = <T>(
  collectionName: string,
  onUpdate: (data: T[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  const colRef = collection(db, collectionName);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: T[] = snapshot.docs.map((d) => d.data() as T);
      onUpdate(items);
    },
    (error) => {
      console.warn(`Firestore snapshot error on [${collectionName}]:`, error);
      if (onError) onError(error);
    }
  );
};

/* ----------------------------------------------------
 * BULK FETCH ALL COLLECTIONS
 * -------------------------------------------------- */
export const fetchAllFromFirestore = async () => {
  try {
    const [
      citizensSnap,
      requestsSnap,
      interviewsSnap,
      chequesSnap,
      lettersSnap,
      orgsSnap,
      usersSnap,
      settingsSnap,
      dropdownsSnap,
      auditSnap
    ] = await Promise.all([
      getDocs(collection(db, 'citizens')),
      getDocs(collection(db, 'requests')),
      getDocs(collection(db, 'interviews')),
      getDocs(collection(db, 'cheques')),
      getDocs(collection(db, 'letters')),
      getDocs(collection(db, 'organizations')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'settings')),
      getDocs(collection(db, 'dropdowns')),
      getDocs(query(collection(db, 'audit_logs'), limit(100)))
    ]);

    return {
      citizens: citizensSnap.docs.map(d => d.data() as Citizen),
      requests: requestsSnap.docs.map(d => d.data() as OfficeRequest),
      interviews: interviewsSnap.docs.map(d => d.data() as Interview),
      cheques: chequesSnap.docs.map(d => d.data() as ChequeRecord),
      letters: lettersSnap.docs.map(d => d.data() as OfficialLetter),
      organizations: orgsSnap.docs.map(d => d.data() as OrganizationRecord),
      users: usersSnap.docs.map(d => d.data() as User),
      settings: settingsSnap.docs.find(d => d.id === 'global_settings')?.data() as SystemSettings | undefined,
      dropdowns: dropdownsSnap.docs.map(d => d.data() as DropdownItem),
      auditLogs: auditSnap.docs.map(d => d.data() as AuditLog)
    };
  } catch (error) {
    console.error('Error fetching all data from Firestore:', error);
    return null;
  }
};

/* ----------------------------------------------------
 * PUSH COMPLETE SYSTEM DATA TO FIRESTORE
 * Seeds or syncs all local tables directly to Firestore
 * -------------------------------------------------- */
export const pushAllStateToFirestore = async (
  citizens: Citizen[],
  requests: OfficeRequest[],
  interviews: Interview[],
  cheques: ChequeRecord[],
  letters: OfficialLetter[],
  orgs: OrganizationRecord[],
  users: User[],
  settings: SystemSettings,
  dropdowns: DropdownItem[]
) => {
  console.log('[Firestore] Initiating complete direct sync to Cloud Firestore...');
  const promises: Promise<any>[] = [];

  for (const c of citizens) {
    promises.push(syncCitizenToFirestore(c));
  }
  for (const r of requests) {
    promises.push(syncRequestToFirestore(r));
  }
  for (const i of interviews) {
    promises.push(syncInterviewToFirestore(i));
  }
  for (const ch of cheques) {
    promises.push(syncChequeToFirestore(ch));
  }
  for (const l of letters) {
    promises.push(syncLetterToFirestore(l));
  }
  for (const o of orgs) {
    promises.push(syncOrgRecordToFirestore(o));
  }
  for (const u of users) {
    promises.push(syncUserToFirestore(u));
  }
  for (const d of dropdowns) {
    promises.push(syncDropdownItemToFirestore(d));
  }
  promises.push(syncSettingsToFirestore(settings));

  const results = await Promise.allSettled(promises);
  const successCount = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[Firestore] Sync complete: ${successCount}/${promises.length} records processed.`);
  return { successCount, total: promises.length };
};

/* ----------------------------------------------------
 * SEED INITIAL DATA IF EMPTY
 * -------------------------------------------------- */
export const seedInitialDataIfEmpty = async (
  initialCitizens: Citizen[],
  initialRequests: OfficeRequest[],
  initialUsers: User[],
  initialSettings: SystemSettings,
  initialLetters: OfficialLetter[]
) => {
  try {
    const snap = await getDocs(collection(db, 'citizens'));
    if (snap.empty) {
      console.log('[Firestore] Collection `citizens` is empty. Seeding data...');
      for (const cit of initialCitizens) {
        await syncCitizenToFirestore(cit);
      }
      for (const r of initialRequests) {
        await syncRequestToFirestore(r);
      }
      for (const u of initialUsers) {
        await syncUserToFirestore(u);
      }
      for (const l of initialLetters) {
        await syncLetterToFirestore(l);
      }
      await syncSettingsToFirestore(initialSettings);
      console.log('[Firestore] Seeding complete! All records now active in Firebase.');
    }
  } catch (err) {
    console.warn('[Firestore] Seeding error:', err);
  }
};

/* ----------------------------------------------------
 * IMAGE ARCHIVE SYNC TO FIRESTORE
 * -------------------------------------------------- */
export const syncImageArchiveToFirestore = async (record: {
  id: string;
  citizenName: string;
  citizenId?: string;
  fileName: string;
  fileSize?: string;
  mimeType?: string;
  uploadedAt: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  extractedText?: string;
}): Promise<boolean> => {
  if (!record?.id) return false;
  try {
    const docRef = doc(db, 'image_archive', record.id);
    const cleaned = cleanData({
      id: record.id,
      citizenName: record.citizenName || 'مواطن عام',
      citizenId: record.citizenId || '',
      fileName: record.fileName || '',
      fileSize: record.fileSize || '',
      mimeType: record.mimeType || 'image/jpeg',
      uploadedAt: record.uploadedAt || new Date().toISOString(),
      driveFileId: record.driveFileId || '',
      driveWebViewLink: record.driveWebViewLink || '',
      extractedText: record.extractedText ? record.extractedText.slice(0, 500) : ''
    });
    await setDoc(docRef, cleaned, { merge: true });
    return true;
  } catch (error) {
    console.warn(`[Firestore] Failed saving image record ${record.id}:`, error);
    return false;
  }
};

/* ----------------------------------------------------
 * WIPE ALL CLOUD DATA FROM FIRESTORE
 * -------------------------------------------------- */
export const wipeAllFirestoreCloudData = async (): Promise<{ success: boolean; deletedCount: number }> => {
  const collectionsToWipe = [
    'citizens', 
    'requests', 
    'interviews', 
    'cheques', 
    'letters', 
    'officialLetters', 
    'organizations', 
    'organizationRecords', 
    'audit_logs', 
    'auditLogs', 
    'image_archive'
  ];
  let deletedCount = 0;

  for (const colName of collectionsToWipe) {
    try {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      for (const d of snapshot.docs) {
        await deleteDoc(doc(db, colName, d.id));
        deletedCount++;
      }
    } catch (e) {
      console.warn(`[Firestore Wipe Warning] Failed wiping collection ${colName}:`, e);
    }
  }

  console.log(`[Firestore] Wiped ${deletedCount} documents across all collections`);
  return { success: true, deletedCount };
};

// import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// import request from 'supertest';
// import { cleanupDb, setupDb } from '../setup';
// import { app } from '../../src/server';
// // Update the import path if the file is located elsewhere, for example:
// import { createStaffAndLogin } from '../utils/auth-helper';


// describe('POST /cases/:id/escalate', () => {
//     beforeEach(async () => {
//         await setupDb();
//     });

//     afterEach(async () => {
//         await cleanupDb();
//     });

//     it('should escalate a case to a department', async () => {
//         // Create staff and login
//         const { staffAuth } = await createStaffAndLogin();

//         // Create a case first
//         const createCaseRes = await request(app)
//             .post('/cases')
//             .set('Authorization', `Bearer device-token`)
//             .send({
//                 studentName: 'John Doe',
//                 category: 'Academic'
//             });

//         expect(createCaseRes.status).toBe(201);
//         const caseId = createCaseRes.body.id;

//         // Take the case
//         await request(app)
//             .post(`/cases/${caseId}/take`)
//             .set(staffAuth)
//             .expect(200);

//         // Escalate the case
//         const escalateRes = await request(app)
//             .post(`/cases/${caseId}/escalate`)
//             .set(staffAuth)
//             .send({
//                 department: 'IT Support'
//             });

//         expect(escalateRes.status).toBe(200);
//         expect(escalateRes.body.escalatedTo).toBe('IT Support');
//         expect(escalateRes.body.status).toBe('IN_PROGRESS'); // Case should still be in progress
//         expect(escalateRes.body.resolvedAt).toBe(null); // Should not be resolved
//     });

//     it('should require department field', async () => {
//         const { staffAuth } = await createStaffAndLogin();

//         // Create a case first
//         const createCaseRes = await request(app)
//             .post('/cases')
//             .set('Authorization', `Bearer device-token`)
//             .send({
//                 studentName: 'John Doe',
//                 category: 'Academic'
//             });

//         const caseId = createCaseRes.body.id;

//         // Take the case
//         await request(app)
//             .post(`/cases/${caseId}/take`)
//             .set(staffAuth)
//             .expect(200);

//         // Try to escalate without department
//         const escalateRes = await request(app)
//             .post(`/cases/${caseId}/escalate`)
//             .set(staffAuth)
//             .send({});

//         expect(escalateRes.status).toBe(400);
//         expect(escalateRes.body.error).toContain('Department is required');
//     });

//     it('should require staff authentication', async () => {
//         // Try to escalate without authentication
//         const escalateRes = await request(app)
//             .post('/cases/some-case-id/escalate')
//             .send({
//                 department: 'IT Support'
//             });

//         expect(escalateRes.status).toBe(401);
//     });

//     it('should return 404 for non-existent case', async () => {
//         const { staffAuth } = await createStaffAndLogin();

//         const escalateRes = await request(app)
//             .post('/cases/non-existent-case/escalate')
//             .set(staffAuth)
//             .send({
//                 department: 'IT Support'
//             });

//         expect(escalateRes.status).toBe(404);
//     });
// });

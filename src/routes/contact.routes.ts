import express from 'express';
import multer from 'multer';
import { 
    getContacts, 
    createContact, 
    updateContact, 
    
    importContacts,
    getContactById,
    uploadContacts,
    getContactFields,
    deleteContacts,
} from '../controllers/contact.controller';
import { verifyToken, authorizeRoles } from "../middlewares/auth.middleware";


const router = express.Router();
router.use(verifyToken);
router.use(authorizeRoles(["admin"]));
const upload = multer({ dest: 'uploads/' });

router.get('/', getContacts);
router.get('/contact-header', getContactFields);
router.delete('/delete-contact', deleteContacts);
router.get('/:id', getContactById);
router.post('/', createContact);
router.post('/import', importContacts);
router.post('/upload', upload.single('file'), uploadContacts);
router.put('/:id', updateContact);

export default router;

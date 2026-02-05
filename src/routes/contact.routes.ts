import express from 'express';
import multer from 'multer';
import { 
    getContacts, 
    createContact, 
    updateContact, 
    deleteContact, 
    importContacts,
    getContactById,
    uploadContacts,
    assignContactToList
} from '../controllers/contact.controller';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.get('/', getContacts);
router.get('/:id', getContactById);
router.post('/', createContact);
router.post('/import', importContacts);
router.post('/upload', upload.single('file'), uploadContacts);
router.post('/assign', assignContactToList);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

export default router;

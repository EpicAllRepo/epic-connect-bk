import express from 'express';
import { 
    getLists, 
    getListById,
    createList, 
    updateList, 
    deleteList 
} from '../controllers/list.controller';

const router = express.Router();

router.get('/', getLists);
router.get('/:id', getListById);
router.post('/', createList);
router.put('/:id', updateList);
router.delete('/:id', deleteList);

export default router;

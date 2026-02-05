import express from 'express';
import { 
    getLists, 
    createList, 
    updateList, 
    deleteList 
} from '../controllers/listController';

const router = express.Router();

router.get('/', getLists);
router.post('/', createList);
router.put('/:id', updateList);
router.delete('/:id', deleteList);

export default router;

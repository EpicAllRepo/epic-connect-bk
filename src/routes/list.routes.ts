import express from 'express';
import { 
    getLists, 
    getListById,
    createList, 
    updateList, 
    deleteList, 
    assignContactToList
} from '../controllers/list.controller';
import { validate } from "../middlewares/validate";
import { body } from "express-validator";



const router = express.Router();

router.get('/', getLists);
router.get('/:id', getListById);
router.post('/', createList);
router.put('/:id', updateList);
router.delete('/:id', deleteList);
router.post(
  "/assign",
  [
    body("contactIds").optional(),
    body("listIds").optional(),
    body("contactId").optional(),
    body("listId").optional()
  ],
  validate,
  assignContactToList
);

export default router;

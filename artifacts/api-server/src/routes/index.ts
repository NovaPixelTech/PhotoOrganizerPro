import { Router, type IRouter } from "express";
import healthRouter from "./health";
import organizeRouter from "./organize";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/organize", organizeRouter);

export default router;

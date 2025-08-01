import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: 'Resource not found',
      status: 404,
      path: req.path,
    },
  });
};
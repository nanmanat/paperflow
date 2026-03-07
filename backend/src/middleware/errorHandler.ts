import { Request, Response, NextFunction } from 'express';
import { RequestError } from '@octokit/request-error';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err);

  // Handle Octokit-specific errors
  if (err instanceof RequestError) {
    res.status(err.status).json({
      error: err.message,
      status: err.status,
      documentation_url: (err.response?.data as any)?.documentation_url,
    });
    return;
  }

  // Handle generic errors
  res.status(500).json({
    error: err.message || 'Internal server error',
    status: 500,
  });
};

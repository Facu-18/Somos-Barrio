import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";

type Schemas = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

export const validate =
  ({ body, params, query }: Schemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (body) {
      req.body = body.parse(req.body);
    }

    if (params) {
      req.params = params.parse(req.params);
    }

    if (query) {
      req.query = query.parse(req.query);
    }

    next();
  };

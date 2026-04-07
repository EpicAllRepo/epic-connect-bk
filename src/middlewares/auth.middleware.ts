import { Request, Response, NextFunction }
from "express";

import jwt from "jsonwebtoken";

export interface AuthRequest
extends Request {

  user?: any;

}

export const verifyToken = (

  req: AuthRequest,

  res: Response,

  next: NextFunction

) => {

  try {

    const token =

      req.cookies.accessToken ||

      req.headers.authorization?.split(" ")[1];

    if (!token) {

      return res.status(401).json({

        message: "No token",

      });

    }

    const decoded = jwt.verify(

      token,

      process.env.JWT_SECRET as string

    ) as any;

    req.user = decoded;

    next();

  } catch {

    return res.status(401).json({

      message:
        "Invalid token",

    });

  }

};


// ROLE CHECK
export const authorizeRoles =
(roles: string[]) => {

  return (

    req: AuthRequest,

    res: Response,

    next: NextFunction

  ) => {

    if (

      !req.user ||

      !roles.includes(req.user.role)

    ) {

      return res.status(403).json({

        message:
          "Access denied",

      });

    }

    next();

  };

};
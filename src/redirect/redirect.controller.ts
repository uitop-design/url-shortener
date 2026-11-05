import { Controller, Get, HttpRedirectResponse, HttpStatus, Param, Redirect } from '@nestjs/common';
import {
  ApiFoundResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { RedirectService } from './redirect.service.js';

@ApiTags('Redirect')
@Controller()
export class RedirectController {
  constructor(private readonly redirectService: RedirectService) {}

  @Get(':code')
  @Redirect()
  @ApiOperation({ summary: 'Redirect to the original URL and count the click' })
  @ApiParam({ name: 'code', example: 'aZ3kQ9x' })
  @ApiFoundResponse({ description: 'Redirects to the original URL via the Location header' })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiGoneResponse({ type: ErrorResponseDto, description: 'Link has expired' })
  async redirect(@Param('code') code: string): Promise<HttpRedirectResponse> {
    return { url: await this.redirectService.resolve(code), statusCode: HttpStatus.FOUND };
  }
}

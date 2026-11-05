import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { CreateLinkDto } from './dto/create-link.dto.js';
import {
  LinkListResponse,
  LinkListResponseDto,
  LinkResponse,
  LinkResponseDto,
} from './dto/link-response.dto.js';
import { ListLinksQueryDto } from './dto/list-links-query.dto.js';
import { LinksService } from './links.service.js';

@ApiTags('Links')
@Controller('links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a short link with an optional alias and lifetime' })
  @ApiCreatedResponse({ type: LinkResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Invalid or reserved input' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Alias is already taken' })
  create(@Body() dto: CreateLinkDto): Promise<LinkResponse> {
    return this.linksService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List links, newest first' })
  @ApiOkResponse({ type: LinkListResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Invalid pagination' })
  findAll(@Query() query: ListLinksQueryDto): Promise<LinkListResponse> {
    return this.linksService.findAll(query);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get link details and click statistics' })
  @ApiParam({ name: 'code', example: 'aZ3kQ9x' })
  @ApiOkResponse({ type: LinkResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  findOne(@Param('code') code: string): Promise<LinkResponse> {
    return this.linksService.findOne(code);
  }

  @Delete(':code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a link and evict it from the redirect cache' })
  @ApiParam({ name: 'code', example: 'aZ3kQ9x' })
  @ApiNoContentResponse({ description: 'Link deleted' })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  remove(@Param('code') code: string): Promise<void> {
    return this.linksService.remove(code);
  }
}

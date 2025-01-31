import { gql } from '@apollo/client'
import { useEffect, useMemo, useState } from 'react'
import { generatePath, useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'

import { Button, InfiniteScroll, Skeleton, Tooltip, Typography } from '~/components/designSystem'
import { WebhookLogDetails } from '~/components/developers/WebhookLogDetails'
import { WebhookLogItem, WebhookLogItemSkeleton } from '~/components/developers/WebhookLogItem'
import { GenericPlaceholder } from '~/components/GenericPlaceholder'
import { SearchInput } from '~/components/SearchInput'
import { WEBHOOK_LOGS_ROUTE, WEBHOOK_LOGS_TAB_ROUTE, WEBHOOK_ROUTE } from '~/core/router'
import {
  useGetWebhookInformationsQuery,
  useGetWebhookLogLazyQuery,
  WebhookLogDetailsFragmentDoc,
  WebhookLogFragment,
  WebhookLogItemFragmentDoc,
  WebhookStatusEnum,
} from '~/generated/graphql'
import { useInternationalization } from '~/hooks/core/useInternationalization'
import { useLocationHistory } from '~/hooks/core/useLocationHistory'
import { useListKeysNavigation } from '~/hooks/ui/useListKeyNavigation'
import { useDebouncedSearch } from '~/hooks/useDebouncedSearch'
import { useOrganizationInfos } from '~/hooks/useOrganizationInfos'
import EmptyImage from '~/public/images/maneki/empty.svg'
import ErrorImage from '~/public/images/maneki/error.svg'
import { HEADER_TABLE_HEIGHT, NAV_HEIGHT, PageHeader, theme } from '~/styles'

gql`
  query getWebhookInformations($id: ID!) {
    webhookEndpoint(id: $id) {
      id
      webhookUrl
    }
  }

  fragment WebhookLog on Webhook {
    id
    createdAt
    endpoint
    ...WebhookLogItem
    ...WebhookLogDetails
  }

  query getWebhookLog(
    $page: Int
    $limit: Int
    $webhookEndpointId: String!
    $status: WebhookStatusEnum
    $searchTerm: String
  ) {
    webhooks(
      page: $page
      limit: $limit
      webhookEndpointId: $webhookEndpointId
      status: $status
      searchTerm: $searchTerm
    ) {
      metadata {
        currentPage
        totalPages
      }
      collection {
        ...WebhookLog
      }
    }
  }

  ${WebhookLogItemFragmentDoc}
  ${WebhookLogDetailsFragmentDoc}
`

const WEBHOOK_ITEM_NAV_KEY = 'webhook-item-'

const WebhookLogs = () => {
  const { webhookId = '' } = useParams<{ webhookId: string }>()
  const { translate } = useInternationalization()
  const { goBack } = useLocationHistory()
  const navigate = useNavigate()
  const { data: webhookUrlData, loading: webhookUrlLoading } = useGetWebhookInformationsQuery({
    variables: { id: webhookId },
    skip: !webhookId,
  })
  const { tab: statusFilter } = useParams<{ tab: WebhookStatusEnum }>()
  const [fetchMoreLoading, setFetchMoreLoading] = useState<boolean>(false)
  const [getWebhookLogs, { data, loading, error, refetch, fetchMore, variables }] =
    useGetWebhookLogLazyQuery({
      variables: {
        webhookEndpointId: webhookId,
        limit: 50,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      notifyOnNetworkStatusChange: true,
    })
  const hasLogs = !!data?.webhooks?.collection?.length
  const [selectedLogId, setSelectedLogId] = useState<string | undefined>(undefined)
  const { debouncedSearch, isLoading } = useDebouncedSearch(getWebhookLogs, loading)
  const { formatTimeOrgaTZ } = useOrganizationInfos()
  const groupedLogs = useMemo(
    () =>
      (data?.webhooks?.collection || []).reduce<Record<string, WebhookLogFragment[]>>(
        (acc, item) => {
          const date = formatTimeOrgaTZ(item.createdAt)

          acc[date] = [...(acc[date] ? acc[date] : []), item]

          return acc
        },
        {},
      ),
    [data?.webhooks?.collection, formatTimeOrgaTZ],
  )
  const { onKeyDown } = useListKeysNavigation({
    getElmId: (i) => `${WEBHOOK_ITEM_NAV_KEY}${i}`,
    navigate: (id) => {
      setSelectedLogId(id as string)
      const element = document.activeElement as HTMLElement

      element.blur && element.blur()
    },
  })

  useEffect(() => {
    if (hasLogs) {
      setSelectedLogId(data?.webhooks?.collection[0]?.id)
    } else {
      setSelectedLogId(undefined)
    }
  }, [hasLogs, data?.webhooks?.collection])

  let index = -1

  return (
    <div role="grid" tabIndex={-1} onKeyDown={onKeyDown}>
      <PageHeader.Wrapper withSide>
        <Header>
          <Button
            icon="arrow-left"
            variant="quaternary"
            onClick={() =>
              goBack(WEBHOOK_ROUTE, { exclude: [WEBHOOK_LOGS_TAB_ROUTE, WEBHOOK_LOGS_ROUTE] })
            }
          />
          {webhookUrlLoading ? (
            <Skeleton variant="text" className="w-60" />
          ) : (
            <>
              <Typography className="mr-1" color="textSecondary" variant="bodyHl" noWrap>
                {translate('text_63e3a496be166d8f3279b594', {
                  url: webhookUrlData?.webhookEndpoint?.webhookUrl,
                })}
              </Typography>
            </>
          )}
        </Header>
        <SearchInput
          onChange={debouncedSearch}
          placeholder={translate('text_63e27c56dfe64b846474ef49')}
        />
      </PageHeader.Wrapper>
      {!!error && !loading && !isLoading ? (
        <GenericPlaceholder
          title={translate('text_63e27c56dfe64b846474ef3a')}
          subtitle={translate('text_63e27c56dfe64b846474ef3b')}
          buttonTitle={translate('text_63e27c56dfe64b846474ef3c')}
          buttonVariant="primary"
          buttonAction={() => location.reload()}
          image={<ErrorImage width="136" height="104" />}
        />
      ) : (
        <Container>
          <LeftSide>
            <Typography
              className="ml-px flex h-18 items-center justify-between bg-white px-12 shadow-b"
              variant="bodyHl"
              color="grey700"
            >
              {translate('text_63e27c56dfe64b846474ef4b')}
              {!!data?.webhooks?.collection && (
                <Tooltip title={translate('text_63e27c56dfe64b846474ef4a')} placement="top-end">
                  <Button
                    icon="reload"
                    variant="quaternary"
                    onClick={async () => {
                      await refetch()
                    }}
                  />
                </Tooltip>
              )}
            </Typography>
            <FilterButtonsWrapper>
              <Button
                variant={!statusFilter ? 'secondary' : 'quaternary'}
                onClick={() => {
                  navigate(
                    generatePath(WEBHOOK_LOGS_ROUTE, {
                      webhookId,
                    }),
                  )
                }}
              >
                {translate('text_63e27c56dfe64b846474ef4c')}
              </Button>
              <Button
                variant={statusFilter === WebhookStatusEnum.Succeeded ? 'secondary' : 'quaternary'}
                onClick={() => {
                  navigate(
                    generatePath(WEBHOOK_LOGS_TAB_ROUTE, {
                      webhookId,
                      tab: WebhookStatusEnum.Succeeded,
                    }),
                  )
                }}
              >
                {translate('text_63e27c56dfe64b846474ef4d')}
              </Button>
              <Button
                variant={statusFilter === WebhookStatusEnum.Failed ? 'secondary' : 'quaternary'}
                onClick={() => {
                  navigate(
                    generatePath(WEBHOOK_LOGS_TAB_ROUTE, {
                      webhookId,
                      tab: WebhookStatusEnum.Failed,
                    }),
                  )
                }}
              >
                {translate('text_63e27c56dfe64b846474ef4e')}
              </Button>
            </FilterButtonsWrapper>

            {!loading && !isLoading && !hasLogs ? (
              <GenericPlaceholder
                className="m-12"
                title={translate(
                  !!variables?.searchTerm
                    ? 'text_63ebafd12755e50052a86e13'
                    : 'text_63ebaf555f88d954d73beb7e',
                )}
                subtitle={
                  !variables?.searchTerm ? (
                    <Typography html={translate('text_63ebafc2c3d08550e5c0341c')} />
                  ) : (
                    translate('text_63ebafd92755e50052a86e14')
                  )
                }
                image={<EmptyImage width="136" height="104" />}
              />
            ) : (
              <LogsList>
                {isLoading && !fetchMoreLoading && !hasLogs && <DateHeader />}
                <InfiniteScroll
                  onBottom={async () => {
                    const { currentPage = 0, totalPages = 0 } = data?.webhooks?.metadata || {}

                    if (currentPage < totalPages && !isLoading) {
                      setFetchMoreLoading(true)
                      await fetchMore({
                        variables: { page: currentPage + 1 },
                      })
                      setFetchMoreLoading(false)
                    }
                  }}
                >
                  <ListContent>
                    {Object.keys(groupedLogs).map((logDate) => {
                      return (
                        <div key={logDate}>
                          <DateHeader>{logDate}</DateHeader>
                          {groupedLogs[logDate].map((log) => {
                            const { id } = log

                            index += 1

                            return (
                              <div key={id}>
                                <WebhookLogItem
                                  log={log}
                                  onClick={() => {
                                    setSelectedLogId(id)
                                    const element = document.activeElement as HTMLElement

                                    element.blur && element.blur()
                                  }}
                                  selected={selectedLogId === id}
                                  navigationProps={{
                                    id: `${WEBHOOK_ITEM_NAV_KEY}${index}`,
                                    'data-id': id,
                                  }}
                                />
                                {selectedLogId === id && (
                                  <LogInfos>
                                    <WebhookLogDetails log={log} />
                                  </LogInfos>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                    {isLoading &&
                      [0, 1, 2].map((i) => (
                        <WebhookLogItemSkeleton key={`webhook-skeleton-item-${i}`} />
                      ))}
                  </ListContent>
                </InfiniteScroll>
              </LogsList>
            )}
          </LeftSide>
          <RightSide>
            {isLoading && (
              <>
                <Typography className="ml-px flex h-18 items-center justify-between bg-white px-12 pl-8 shadow-b">
                  <Skeleton variant="text" className="w-45" />
                </Typography>
                <LogPropertiesSkeleton>
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={`skeleton-event-${i}`}>
                      <Skeleton variant="text" className="mr-18 w-20" />
                      <Skeleton variant="text" className="mr-auto w-60" />
                    </div>
                  ))}
                </LogPropertiesSkeleton>
                <Payload />
              </>
            )}
          </RightSide>
        </Container>
      )}
    </div>
  )
}

export default WebhookLogs

const Header = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  margin-right: ${theme.spacing(4)};

  > *:first-child {
    margin-right: ${theme.spacing(3)};
  }
`

const Container = styled.div`
  position: relative;
  display: flex;
  height: calc(100vh - ${NAV_HEIGHT}px);
`

const LeftSide = styled.div`
  width: 50%;

  ${theme.breakpoints.down('md')} {
    width: 100%;
  }
`

const RightSide = styled.div`
  width: 50%;
  height: 100%;
  box-shadow: ${theme.shadows[8]};
  display: flex;
  flex-direction: column;
  background-color: ${theme.palette.grey[100]};

  ${theme.breakpoints.down('md')} {
    display: none;
  }
`

const LogsList = styled.div`
  height: calc(100vh - (3 * ${NAV_HEIGHT}px));
  overflow: scroll;
`

const LogPropertiesSkeleton = styled.div`
  padding: ${theme.spacing(10)} ${theme.spacing(8)};
  box-shadow: ${theme.shadows[7]};
  margin-left: 1px;
  background-color: ${theme.palette.common.white};

  > * {
    display: flex;
    &:not(:last-child) {
      margin-bottom: ${theme.spacing(7)};
    }
  }
`

const Payload = styled.div`
  flex: 1;
  box-shadow: ${theme.shadows[8]};
  background-color: ${theme.palette.grey[100]};

  ${theme.breakpoints.down('md')} {
    box-shadow: ${theme.shadows[7]};
  }
`

const LogInfos = styled.div`
  width: 50%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 0;
  right: 0;
  overflow: auto;
  box-shadow: ${theme.shadows[8]};
  background-color: ${theme.palette.background.default};
  z-index: 1;

  ${theme.breakpoints.down('md')} {
    position: initial;
    box-shadow: ${theme.shadows[7]};
    width: 100%;
  }
`

const DateHeader = styled.div`
  height: ${HEADER_TABLE_HEIGHT}px;
  display: flex;
  align-items: center;
  padding: 0 ${theme.spacing(12)};
  background-color: ${theme.palette.grey[100]};
  box-shadow: ${theme.shadows[7]};
  position: sticky;
  top: 0;
  z-index: 1;
`

const ListContent = styled.div`
  margin-bottom: ${theme.spacing(20)};
`

const FilterButtonsWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing(3)};
  padding: ${theme.spacing(4)} ${theme.spacing(12)};
  box-shadow: ${theme.shadows[7]};
`
